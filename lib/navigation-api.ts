import { ApiAuthError, authenticateAnalysisRequest } from "@/lib/api-auth";
import {
  claimIdempotency,
  completeIdempotency,
  releaseIdempotency,
  validateIdempotencyKey,
  type IdempotencyClaim,
} from "@/lib/idempotency";
import { validateNavigationRouteRequest } from "@/lib/navigation-validation";
import {
  NavigationProviderError,
  planWithOpenRouteService,
} from "@/lib/openrouteservice";
import { API_VERSION, isStrictProduction } from "@/lib/production-config";
import {
  checkAnalysisRateLimit,
  clientRateLimitKey,
  type RateLimitDecision,
} from "@/lib/rate-limit";
import { sha256 } from "@/lib/redis-rest";
import type {
  NavigationErrorCode,
  NavigationErrorResponse,
  NavigationRouteResult,
} from "@/types/navigation";

type Environment = Record<string, string | undefined>;
const MAX_NAVIGATION_BODY_BYTES = 8 * 1024;

function requestId(headers: Headers): string {
  const supplied = headers.get("x-request-id")?.trim();
  if (supplied && /^[A-Za-z0-9._:-]{8,100}$/.test(supplied)) return supplied;
  return globalThis.crypto?.randomUUID?.() ?? `nav-${Date.now().toString(36)}`;
}

function allowedOrigin(request: Request, environment: Environment): string | undefined {
  const origin = request.headers.get("origin") ?? undefined;
  if (!origin) return undefined;
  const allowed = (environment.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return origin === new URL(request.url).origin || allowed.includes(origin)
    ? origin
    : undefined;
}

function headers(
  request: Request,
  id: string,
  environment: Environment,
  additional: Record<string, string> = {},
): Record<string, string> {
  const origin = allowedOrigin(request, environment);
  return {
    "Cache-Control": "no-store, max-age=0",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Permissions-Policy": "camera=(), microphone=()",
    "Referrer-Policy": "no-referrer",
    "X-API-Version": API_VERSION,
    "X-Content-Type-Options": "nosniff",
    "X-Request-Id": id,
    ...(origin
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Credentials": "true",
          Vary: "Origin",
        }
      : {}),
    ...additional,
  };
}

function json(
  request: Request,
  body: unknown,
  id: string,
  environment: Environment,
  status = 200,
  additional: Record<string, string> = {},
): Response {
  return Response.json(body, {
    status,
    headers: headers(request, id, environment, additional),
  });
}

function error(
  request: Request,
  code: NavigationErrorCode,
  message: string,
  status: number,
  retryable: boolean,
  id: string,
  environment: Environment,
  additional: Record<string, string> = {},
): Response {
  const body: NavigationErrorResponse = {
    error: { code, message, retryable, requestId: id },
  };
  return json(request, body, id, environment, status, additional);
}

async function readBody(request: Request): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_NAVIGATION_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return chunks.join("");
  } finally {
    reader.releaseLock();
  }
}

function rateHeaders(decision: RateLimitDecision): Record<string, string> {
  return {
    "RateLimit-Limit": String(decision.limit),
    "RateLimit-Remaining": String(decision.remaining),
    "RateLimit-Reset": String(Math.ceil(decision.resetAt / 1_000)),
    ...(decision.retryAfterSeconds
      ? { "Retry-After": String(decision.retryAfterSeconds) }
      : {}),
  };
}

async function release(
  claim: Extract<IdempotencyClaim, { outcome: "claimed" }> | undefined,
  environment: Environment,
): Promise<void> {
  if (claim) await releaseIdempotency(claim, { environment }).catch(() => undefined);
}

export async function handleNavigationRoute(
  request: Request,
  environment: Environment = process.env,
): Promise<Response> {
  const id = requestId(request.headers);
  const startedAt = Date.now();
  const origin = request.headers.get("origin");
  if (origin && !allowedOrigin(request, environment) && isStrictProduction(environment)) {
    return error(request, "FORBIDDEN", "This origin is not allowed.", 403, false, id, environment);
  }

  let principal;
  try {
    principal = await authenticateAnalysisRequest(request, environment, {
      scopeEnvironmentVariable: "AUTH_NAVIGATION_SCOPE",
      defaultProductionScope: "navigation:route",
    });
  } catch (caught) {
    const mapped =
      caught instanceof ApiAuthError
        ? caught
        : new ApiAuthError("AUTHENTICATION_REQUIRED", "Authentication failed.", 401);
    return error(
      request,
      mapped.code === "CONFIGURATION_ERROR"
        ? "CONFIGURATION_ERROR"
        : mapped.code === "FORBIDDEN"
          ? "FORBIDDEN"
          : "AUTHENTICATION_REQUIRED",
      mapped.message,
      mapped.status,
      false,
      id,
      environment,
      { "WWW-Authenticate": 'Bearer realm="visionaid"' },
    );
  }

  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {
    return error(
      request,
      "VALIDATION_ERROR",
      "Content-Type must be application/json.",
      415,
      false,
      id,
      environment,
    );
  }

  let rateLimit: RateLimitDecision;
  try {
    rateLimit = await checkAnalysisRateLimit(
      `navigation:${principal.anonymous ? clientRateLimitKey(request.headers) : principal.subject}`,
      { signal: request.signal, environment },
    );
  } catch {
    return error(
      request,
      "SERVICE_UNAVAILABLE",
      "Navigation traffic controls are unavailable.",
      503,
      true,
      id,
      environment,
      { "Retry-After": "2" },
    );
  }
  if (!rateLimit.allowed) {
    return error(
      request,
      "RATE_LIMITED",
      "Too many route requests. Please wait and try again.",
      429,
      true,
      id,
      environment,
      rateHeaders(rateLimit),
    );
  }

  const text = await readBody(request).catch(() => undefined);
  if (text === null) {
    return error(
      request,
      "VALIDATION_ERROR",
      "The navigation request is too large.",
      413,
      false,
      id,
      environment,
      rateHeaders(rateLimit),
    );
  }
  let payload: unknown;
  try {
    payload = JSON.parse(text ?? "");
  } catch {
    return error(
      request,
      "VALIDATION_ERROR",
      "The request body must be valid JSON.",
      400,
      false,
      id,
      environment,
      rateHeaders(rateLimit),
    );
  }
  const validated = validateNavigationRouteRequest(payload);
  if (!validated.ok) {
    return error(
      request,
      "VALIDATION_ERROR",
      validated.error,
      400,
      false,
      id,
      environment,
      rateHeaders(rateLimit),
    );
  }

  const rawKey = request.headers.get("idempotency-key");
  const key = validateIdempotencyKey(rawKey);
  if ((rawKey && !key) || (!key && isStrictProduction(environment))) {
    return error(
      request,
      "VALIDATION_ERROR",
      "A valid Idempotency-Key is required.",
      400,
      false,
      id,
      environment,
      rateHeaders(rateLimit),
    );
  }

  let claim: Extract<IdempotencyClaim, { outcome: "claimed" }> | undefined;
  try {
    const claimed = await claimIdempotency({
      key: key ?? `development-${id}`,
      scope: `navigation:${principal.subject}`,
      fingerprint: await sha256(JSON.stringify(validated.value)),
      signal: request.signal,
      environment,
    });
    if (claimed.outcome === "replay") {
      return json(request, claimed.value, id, environment, 200, {
        ...rateHeaders(rateLimit),
        "Idempotency-Replayed": "true",
      });
    }
    if (claimed.outcome === "conflict" || claimed.outcome === "in_progress") {
      return error(
        request,
        "IDEMPOTENCY_CONFLICT",
        claimed.outcome === "in_progress"
          ? "This route request is already in progress."
          : "The idempotency key was used for different route data.",
        409,
        claimed.outcome === "in_progress",
        id,
        environment,
        claimed.outcome === "in_progress" ? { "Retry-After": "1" } : {},
      );
    }
    claim = claimed;
  } catch {
    return error(
      request,
      "SERVICE_UNAVAILABLE",
      "Navigation request deduplication is unavailable.",
      503,
      true,
      id,
      environment,
      { "Retry-After": "2" },
    );
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 10_000);
  const abortFromRequest = () => controller.abort();
  request.signal.addEventListener("abort", abortFromRequest, { once: true });
  if (request.signal.aborted) controller.abort();
  try {
    const result = await planWithOpenRouteService(validated.value, id, controller.signal, {
      environment,
    });
    let committed = true;
    try {
      await completeIdempotency(claim!, result, { environment });
    } catch {
      committed = false;
    }
    return json(request, result, id, environment, 200, {
      ...rateHeaders(rateLimit),
      "Idempotency-Committed": String(committed),
      "Server-Timing": `total;dur=${Date.now() - startedAt}`,
    });
  } catch (caught) {
    await release(claim, environment);
    const mapped =
      caught instanceof NavigationProviderError
        ? caught
        : new NavigationProviderError(
            timedOut ? "TIMEOUT" : "UPSTREAM_ERROR",
            timedOut ? "Route planning timed out." : "Route planning failed.",
            timedOut ? 504 : 502,
            true,
          );
    return error(
      request,
      mapped.code,
      mapped.message,
      mapped.status,
      mapped.retryable,
      id,
      environment,
      {
        ...rateHeaders(rateLimit),
        ...(mapped.retryAfterMs
          ? { "Retry-After": String(Math.max(1, Math.ceil(mapped.retryAfterMs / 1_000))) }
          : {}),
        "Server-Timing": `total;dur=${Date.now() - startedAt}`,
      },
    );
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", abortFromRequest);
  }
}

export function handleNavigationOptions(
  request: Request,
  environment: Environment = process.env,
): Response {
  const id = requestId(request.headers);
  const origin = request.headers.get("origin");
  if (origin && !allowedOrigin(request, environment) && isStrictProduction(environment)) {
    return error(request, "FORBIDDEN", "This origin is not allowed.", 403, false, id, environment);
  }
  return new Response(null, {
    status: 204,
    headers: headers(request, id, environment, {
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, Idempotency-Key, X-Request-Id",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Max-Age": "600",
    }),
  });
}
