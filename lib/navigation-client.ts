import {
  isNavigationErrorResponse,
  validateNavigationRouteRequest,
  validateNavigationRouteResult,
} from "@/lib/navigation-validation";
import { parseRetryAfter, withRetry } from "@/lib/resilience";
import type {
  NavigationClientOptions,
  NavigationErrorCode,
  NavigationRouteRequest,
  NavigationRouteResult,
} from "@/types/navigation";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_ATTEMPTS = 2;

export class NavigationApiError extends Error {
  constructor(
    readonly code: NavigationErrorCode,
    message: string,
    readonly options: {
      retryable: boolean;
      status?: number;
      requestId?: string;
      retryAfterMs?: number;
      cause?: unknown;
    },
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "NavigationApiError";
  }

  get retryable(): boolean {
    return this.options.retryable;
  }

  get status(): number | undefined {
    return this.options.status;
  }

  get requestId(): string | undefined {
    return this.options.requestId;
  }

  get retryAfterMs(): number | undefined {
    return this.options.retryAfterMs;
  }
}

export function getNavigationEndpoint(baseUrl = process.env.EXPO_PUBLIC_API_URL): string {
  const base = baseUrl?.trim().replace(/\/+$/, "") ?? "";
  if (!base) return "/api/v1/navigation/route";
  if (base.endsWith("/api/v1/navigation/route")) return base;
  return `${base}/api/v1/navigation/route`;
}

function operationId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid
    ? `${prefix}-${uuid}`
    : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function validOperationId(value: string, minimum: number): boolean {
  return value.length >= minimum && value.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(value);
}

function normalizeOptions(options: NavigationClientOptions): {
  timeoutMs: number;
  maxAttempts: number;
  requestId: string;
  idempotencyKey: string;
} {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    throw new NavigationApiError(
      "VALIDATION_ERROR",
      "timeoutMs must be between 1 and 60000 milliseconds.",
      { retryable: false },
    );
  }
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3) {
    throw new NavigationApiError(
      "VALIDATION_ERROR",
      "maxAttempts must be between 1 and 3.",
      { retryable: false },
    );
  }
  if (options.accessToken && options.getAccessToken) {
    throw new NavigationApiError(
      "VALIDATION_ERROR",
      "Supply accessToken or getAccessToken, not both.",
      { retryable: false },
    );
  }
  const requestId = options.requestId?.trim() || operationId("navreq");
  const idempotencyKey = options.idempotencyKey?.trim() || operationId("navidem");
  if (!validOperationId(requestId, 8) || !validOperationId(idempotencyKey, 16)) {
    throw new NavigationApiError(
      "VALIDATION_ERROR",
      "requestId or idempotencyKey has an invalid format.",
      { retryable: false },
    );
  }
  return { timeoutMs, maxAttempts, requestId, idempotencyKey };
}

function retryable(error: unknown): boolean {
  return (
    error instanceof NavigationApiError &&
    error.retryable &&
    [
      "RATE_LIMITED",
      "IDEMPOTENCY_CONFLICT",
      "NETWORK_ERROR",
      "UPSTREAM_ERROR",
      "SERVICE_UNAVAILABLE",
    ].includes(error.code)
  );
}

export async function planNavigationRoute(
  request: NavigationRouteRequest,
  options: NavigationClientOptions = {},
): Promise<NavigationRouteResult> {
  const validated = validateNavigationRouteRequest(request);
  if (!validated.ok) {
    throw new NavigationApiError("VALIDATION_ERROR", validated.error, {
      retryable: false,
    });
  }
  const normalized = normalizeOptions(options);
  const controller = new AbortController();
  let didTimeout = false;
  const timeout = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, normalized.timeoutMs);
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  if (options.signal?.aborted) controller.abort();

  try {
    return await withRetry(
      async () => {
        if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
        let accessToken: string | undefined;
        try {
          accessToken = (options.accessToken ?? (await options.getAccessToken?.()))?.trim();
        } catch (error) {
          throw new NavigationApiError(
            "AUTHENTICATION_REQUIRED",
            "A valid access token could not be obtained.",
            { retryable: false, cause: error },
          );
        }

        let response: Response;
        try {
          response = await fetch(getNavigationEndpoint(options.baseUrl), {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "Idempotency-Key": normalized.idempotencyKey,
              "X-Request-Id": normalized.requestId,
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
            body: JSON.stringify(validated.value),
            signal: controller.signal,
          });
        } catch (error) {
          if (controller.signal.aborted) throw error;
          throw new NavigationApiError(
            "NETWORK_ERROR",
            "Could not reach the route-planning service.",
            { retryable: true, cause: error },
          );
        }

        let body: unknown = null;
        try {
          body = await response.json();
        } catch {
          // Invalid bodies are mapped to a typed upstream failure below.
        }
        if (!response.ok) {
          const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
          if (isNavigationErrorResponse(body)) {
            throw new NavigationApiError(body.error.code, body.error.message, {
              retryable: body.error.retryable,
              status: response.status,
              requestId: body.error.requestId,
              retryAfterMs,
            });
          }
          throw new NavigationApiError(
            response.status === 401
              ? "AUTHENTICATION_REQUIRED"
              : response.status === 403
                ? "FORBIDDEN"
                : response.status === 404
                  ? "NO_ROUTE"
                  : response.status === 429
                    ? "RATE_LIMITED"
                    : "SERVICE_UNAVAILABLE",
            "The route-planning service returned an unexpected response.",
            {
              retryable: response.status === 429 || response.status >= 500,
              status: response.status,
              retryAfterMs,
            },
          );
        }
        const route = validateNavigationRouteResult(body);
        if (!route.ok) {
          throw new NavigationApiError(
            "UPSTREAM_ERROR",
            "The route-planning service returned a malformed route.",
            { retryable: false, status: response.status },
          );
        }
        return route.value;
      },
      {
        maxAttempts: normalized.maxAttempts,
        baseDelayMs: 250,
        maxDelayMs: 1_000,
        signal: controller.signal,
        shouldRetry: retryable,
      },
    );
  } catch (error) {
    if (didTimeout) {
      throw new NavigationApiError("TIMEOUT", "Route planning timed out.", {
        retryable: true,
        cause: error,
      });
    }
    if (options.signal?.aborted) {
      throw new NavigationApiError("CANCELLED", "Route planning was cancelled.", {
        retryable: false,
        cause: error,
      });
    }
    if (error instanceof NavigationApiError) throw error;
    throw new NavigationApiError(
      "NETWORK_ERROR",
      "Could not reach the route-planning service.",
      { retryable: true, cause: error },
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}
