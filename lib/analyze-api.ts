import { ApiAuthError, authenticateAnalysisRequest } from "@/lib/api-auth";
import {
  MAX_JSON_BODY_BYTES,
  makeErrorResponse,
  validateAnalysisRequest,
} from "@/lib/analysis-validation";
import { createDemoAnalysis } from "@/lib/demo-analysis";
import {
  claimIdempotency,
  completeIdempotency,
  releaseIdempotency,
  validateIdempotencyKey,
  type IdempotencyClaim,
} from "@/lib/idempotency";
import { analyzeWithVisionProvider } from "@/lib/vision-analysis";
import { VisionProviderError } from "@/lib/vision-provider";
import {
  API_VERSION,
  booleanEnvironmentValue,
  isStrictProduction,
} from "@/lib/production-config";
import {
  checkAnalysisRateLimit,
  clientRateLimitKey,
  RateLimitConfigurationError,
  type RateLimitDecision,
} from "@/lib/rate-limit";
import { sha256 } from "@/lib/redis-rest";
import { emitAnalysisTelemetry } from "@/lib/telemetry";
import type {
  AnalysisErrorCode,
  AnalysisRequest,
  AnalysisResult,
} from "@/types/analysis";

type Environment = Record<string, string | undefined>;

function createRequestId(headers: Headers): string {
  const supplied = headers.get("x-request-id")?.trim();
  if (supplied && /^[A-Za-z0-9._:-]{8,100}$/.test(supplied)) return supplied;
  return globalThis.crypto?.randomUUID?.() ?? `req-${Date.now().toString(36)}`;
}

function originHeaders(request: Request, environment: Environment): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin) return {};
  const requestOrigin = new URL(request.url).origin;
  const configured = (environment.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowed = origin === requestOrigin || configured.includes(origin);
  return allowed
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        Vary: "Origin",
      }
    : {};
}

function isOriginAllowed(request: Request, environment: Environment): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  if (originHeaders(request, environment)["Access-Control-Allow-Origin"]) return true;
  return !isStrictProduction(environment);
}

function baseHeaders(
  request: Request,
  id: string,
  environment: Environment,
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-API-Version": API_VERSION,
    "X-Request-Id": id,
    ...originHeaders(request, environment),
    ...extra,
  };
}

function jsonResponse(
  request: Request,
  body: unknown,
  id: string,
  environment: Environment,
  status = 200,
  additionalHeaders: Record<string, string> = {},
): Response {
  return Response.json(body, {
    status,
    headers: baseHeaders(request, id, environment, additionalHeaders),
  });
}

function errorResponse(
  request: Request,
  code: AnalysisErrorCode,
  message: string,
  status: number,
  retryable: boolean,
  id: string,
  environment: Environment,
  additionalHeaders: Record<string, string> = {},
): Response {
  return jsonResponse(
    request,
    makeErrorResponse(code, message, retryable, id),
    id,
    environment,
    status,
    additionalHeaders,
  );
}

async function readBodyWithLimit(
  request: Request,
  maxBytes: number,
): Promise<{ text?: string; tooLarge: boolean }> {
  if (!request.body) return { text: "", tooLarge: false };
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        return { tooLarge: true };
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return { text: chunks.join(""), tooLarge: false };
  } finally {
    reader.releaseLock();
  }
}

function rateLimitHeaders(decision: RateLimitDecision): Record<string, string> {
  return {
    "RateLimit-Limit": String(decision.limit),
    "RateLimit-Remaining": String(decision.remaining),
    "RateLimit-Reset": String(Math.ceil(decision.resetAt / 1_000)),
    ...(decision.retryAfterSeconds > 0
      ? { "Retry-After": String(decision.retryAfterSeconds) }
      : {}),
  };
}

function idempotencyError(
  request: Request,
  outcome: "in_progress" | "conflict",
  id: string,
  environment: Environment,
): Response {
  return errorResponse(
    request,
    "IDEMPOTENCY_CONFLICT",
    outcome === "in_progress"
      ? "This analysis request is already in progress."
      : "The idempotency key was already used for different request data.",
    409,
    outcome === "in_progress",
    id,
    environment,
    outcome === "in_progress" ? { "Retry-After": "1" } : {},
  );
}

async function safelyRelease(
  claim: Extract<IdempotencyClaim, { outcome: "claimed" }> | undefined,
  environment: Environment,
): Promise<void> {
  if (!claim) return;
  await releaseIdempotency(claim, { environment }).catch(() => undefined);
}

export async function handleAnalyze(
  request: Request,
  environment: Environment = process.env,
): Promise<Response> {
  const id = createRequestId(request.headers);
  const startedAt = Date.now();
  let mode: AnalysisRequest["mode"] = "describe";
  let claimed: Extract<IdempotencyClaim, { outcome: "claimed" }> | undefined;

  if (!isOriginAllowed(request, environment)) {
    return errorResponse(
      request,
      "FORBIDDEN",
      "This origin is not allowed.",
      403,
      false,
      id,
      environment,
    );
  }

  let principal;
  try {
    principal = await authenticateAnalysisRequest(request, environment);
  } catch (error) {
    const mapped =
      error instanceof ApiAuthError
        ? error
        : new ApiAuthError(
            "AUTHENTICATION_REQUIRED",
            "Authentication could not be completed.",
            401,
          );
    return errorResponse(
      request,
      mapped.code,
      mapped.message,
      mapped.status,
      false,
      id,
      environment,
      { "WWW-Authenticate": 'Bearer realm="visionaid"' },
    );
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return errorResponse(
      request,
      "UNSUPPORTED_MEDIA_TYPE",
      "Content-Type must be application/json.",
      415,
      false,
      id,
      environment,
    );
  }

  const rawRateKey = principal.anonymous
    ? clientRateLimitKey(request.headers)
    : `subject:${principal.subject}`;
  let rateLimit: RateLimitDecision;
  try {
    rateLimit = await checkAnalysisRateLimit(rawRateKey, {
      signal: request.signal,
      environment,
    });
  } catch (error) {
    return errorResponse(
      request,
      "SERVICE_UNAVAILABLE",
      error instanceof RateLimitConfigurationError
        ? "Production traffic controls are not configured."
        : "Traffic controls are temporarily unavailable.",
      503,
      true,
      id,
      environment,
      { "Retry-After": "2" },
    );
  }
  if (!rateLimit.allowed) {
    return errorResponse(
      request,
      "RATE_LIMITED",
      "Too many analysis requests. Please wait and try again.",
      429,
      true,
      id,
      environment,
      rateLimitHeaders(rateLimit),
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BODY_BYTES) {
    return errorResponse(
      request,
      "PAYLOAD_TOO_LARGE",
      "The request body is too large.",
      413,
      false,
      id,
      environment,
      rateLimitHeaders(rateLimit),
    );
  }

  let readBody: { text?: string; tooLarge: boolean };
  try {
    readBody = await readBodyWithLimit(request, MAX_JSON_BODY_BYTES);
  } catch {
    return errorResponse(
      request,
      "VALIDATION_ERROR",
      "The request body could not be read.",
      400,
      false,
      id,
      environment,
      rateLimitHeaders(rateLimit),
    );
  }
  if (readBody.tooLarge) {
    return errorResponse(
      request,
      "PAYLOAD_TOO_LARGE",
      "The request body is too large.",
      413,
      false,
      id,
      environment,
      rateLimitHeaders(rateLimit),
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(readBody.text ?? "");
  } catch {
    return errorResponse(
      request,
      "VALIDATION_ERROR",
      "The request body must be valid JSON.",
      400,
      false,
      id,
      environment,
      rateLimitHeaders(rateLimit),
    );
  }

  const validated = validateAnalysisRequest(body);
  if (!validated.ok) {
    return errorResponse(
      request,
      "VALIDATION_ERROR",
      validated.error,
      400,
      false,
      id,
      environment,
      rateLimitHeaders(rateLimit),
    );
  }
  mode = validated.value.mode;

  const rawIdempotencyKey = request.headers.get("idempotency-key");
  const idempotencyKey = validateIdempotencyKey(rawIdempotencyKey);
  if (rawIdempotencyKey && !idempotencyKey) {
    return errorResponse(
      request,
      "VALIDATION_ERROR",
      "Idempotency-Key must be 16–128 safe ASCII characters.",
      400,
      false,
      id,
      environment,
      rateLimitHeaders(rateLimit),
    );
  }
  if (!idempotencyKey && isStrictProduction(environment)) {
    return errorResponse(
      request,
      "VALIDATION_ERROR",
      "Idempotency-Key is required for production analysis requests.",
      400,
      false,
      id,
      environment,
      rateLimitHeaders(rateLimit),
    );
  }

  try {
    const fingerprint = await sha256(JSON.stringify(validated.value));
    const claim = await claimIdempotency({
      key: idempotencyKey ?? `development-${id}`,
      scope: principal.subject,
      fingerprint,
      signal: request.signal,
      environment,
    });
    if (claim.outcome === "replay") {
      return jsonResponse(request, claim.value, id, environment, 200, {
        ...rateLimitHeaders(rateLimit),
        "Idempotency-Replayed": "true",
      });
    }
    if (claim.outcome === "in_progress" || claim.outcome === "conflict") {
      return idempotencyError(request, claim.outcome, id, environment);
    }
    claimed = claim;
  } catch {
    return errorResponse(
      request,
      "SERVICE_UNAVAILABLE",
      "Request deduplication is temporarily unavailable.",
      503,
      true,
      id,
      environment,
      { "Retry-After": "2", ...rateLimitHeaders(rateLimit) },
    );
  }

  try {
    let result: AnalysisResult;
    let modelHeaders: Record<string, string> = {};
    if (validated.value.demo) {
      const allowDemo = booleanEnvironmentValue(
        "ALLOW_API_DEMO",
        !isStrictProduction(environment),
        environment,
      );
      if (!allowDemo) {
        await safelyRelease(claimed, environment);
        return errorResponse(
          request,
          "FORBIDDEN",
          "Server demo responses are disabled in production.",
          403,
          false,
          id,
          environment,
          rateLimitHeaders(rateLimit),
        );
      }
      result = { ...createDemoAnalysis(validated.value), requestId: id };
    } else {
      const outcome = await analyzeWithVisionProvider(
        validated.value,
        id,
        request.signal,
        { environment },
      );
      result = outcome.result;
      modelHeaders = {
        "X-Vision-Provider": outcome.provider,
        "X-Model-Role": outcome.modelRole,
        "X-Provider-Attempts": String(outcome.attempts),
      };
    }

    let idempotencyCommitted = true;
    try {
      await completeIdempotency(claimed!, result, { environment });
    } catch {
      idempotencyCommitted = false;
    }
    return jsonResponse(request, result, id, environment, 200, {
      ...rateLimitHeaders(rateLimit),
      ...modelHeaders,
      "Idempotency-Committed": String(idempotencyCommitted),
      "Server-Timing": `total;dur=${Date.now() - startedAt}`,
    });
  } catch (error) {
    await safelyRelease(claimed, environment);
    const mapped =
      error instanceof VisionProviderError
        ? error
        : new VisionProviderError(
            "UPSTREAM_ERROR",
            "Visual analysis failed unexpectedly.",
            502,
            true,
            { cause: error },
          );
    emitAnalysisTelemetry({
      event: "analysis.failed",
      requestId: id,
      mode,
      durationMs: Date.now() - startedAt,
      status: mapped.status,
      errorCode: mapped.code,
    });
    return errorResponse(
      request,
      mapped.code,
      mapped.message,
      mapped.status,
      mapped.retryable,
      id,
      environment,
      {
        ...rateLimitHeaders(rateLimit),
        ...(mapped.retryAfterMs
          ? { "Retry-After": String(Math.max(1, Math.ceil(mapped.retryAfterMs / 1_000))) }
          : {}),
        "Server-Timing": `total;dur=${Date.now() - startedAt}`,
      },
    );
  }
}

export function handleAnalyzeOptions(
  request: Request,
  environment: Environment = process.env,
): Response {
  const id = createRequestId(request.headers);
  if (!isOriginAllowed(request, environment)) {
    return errorResponse(
      request,
      "FORBIDDEN",
      "This origin is not allowed.",
      403,
      false,
      id,
      environment,
    );
  }
  return new Response(null, {
    status: 204,
    headers: baseHeaders(request, id, environment, {
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, Idempotency-Key, X-Request-Id",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Max-Age": "600",
    }),
  });
}
