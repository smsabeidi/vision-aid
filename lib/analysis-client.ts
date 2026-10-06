import { createDemoAnalysis } from "@/lib/demo-analysis";
import {
  isAnalysisErrorResponse,
  validateAnalysisRequest,
  validateAnalysisResult,
} from "@/lib/analysis-validation";
import { parseRetryAfter, withRetry } from "@/lib/resilience";
import type {
  AnalysisClientOptions,
  AnalysisErrorCode,
  AnalysisRequest,
  AnalysisResult,
} from "@/types/analysis";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_ATTEMPTS = 2;

export class AnalysisApiError extends Error {
  readonly code: AnalysisErrorCode;
  readonly retryable: boolean;
  readonly status?: number;
  readonly requestId?: string;
  readonly retryAfterMs?: number;

  constructor(
    code: AnalysisErrorCode,
    message: string,
    options: {
      retryable: boolean;
      status?: number;
      requestId?: string;
      retryAfterMs?: number;
      cause?: unknown;
    },
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AnalysisApiError";
    this.code = code;
    this.retryable = options.retryable;
    this.status = options.status;
    this.requestId = options.requestId;
    this.retryAfterMs = options.retryAfterMs;
  }
}

export function getAnalysisEndpoint(baseUrl = process.env.EXPO_PUBLIC_API_URL): string {
  const base = baseUrl?.trim().replace(/\/+$/, "") ?? "";
  if (!base) return "/api/v1/analyze";
  if (base.endsWith("/api/v1/analyze") || base.endsWith("/api/analyze")) return base;
  return `${base}/api/v1/analyze`;
}

function operationId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `${prefix}-${uuid}` : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function validOperationId(value: string, minimum: number): boolean {
  return value.length >= minimum && value.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(value);
}

function shouldUseDemo(error: AnalysisApiError): boolean {
  return (
    error.retryable &&
    [
      "NETWORK_ERROR",
      "TIMEOUT",
      "RATE_LIMITED",
      "UPSTREAM_ERROR",
      "SERVICE_UNAVAILABLE",
      "INVALID_MODEL_RESPONSE",
    ].includes(error.code)
  );
}

function shouldRetry(error: unknown): boolean {
  return (
    error instanceof AnalysisApiError &&
    error.retryable &&
    [
      "NETWORK_ERROR",
      "RATE_LIMITED",
      "UPSTREAM_ERROR",
      "SERVICE_UNAVAILABLE",
      "INVALID_MODEL_RESPONSE",
      "IDEMPOTENCY_CONFLICT",
    ].includes(error.code)
  );
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function validateOptions(options: AnalysisClientOptions): {
  timeoutMs: number;
  maxAttempts: number;
  requestId: string;
  idempotencyKey: string;
} {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) {
    throw new AnalysisApiError(
      "VALIDATION_ERROR",
      "timeoutMs must be between 1 and 120000 milliseconds.",
      { retryable: false },
    );
  }
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3) {
    throw new AnalysisApiError(
      "VALIDATION_ERROR",
      "maxAttempts must be between 1 and 3.",
      { retryable: false },
    );
  }
  if (options.accessToken && options.getAccessToken) {
    throw new AnalysisApiError(
      "VALIDATION_ERROR",
      "Supply accessToken or getAccessToken, not both.",
      { retryable: false },
    );
  }
  const requestId = options.requestId?.trim() || operationId("req");
  const idempotencyKey = options.idempotencyKey?.trim() || operationId("idem");
  if (!validOperationId(requestId, 8) || !validOperationId(idempotencyKey, 16)) {
    throw new AnalysisApiError(
      "VALIDATION_ERROR",
      "requestId or idempotencyKey has an invalid format.",
      { retryable: false },
    );
  }
  return { timeoutMs, maxAttempts, requestId, idempotencyKey };
}

export async function analyzeImage(
  request: AnalysisRequest,
  options: AnalysisClientOptions = {},
): Promise<AnalysisResult> {
  const validated = validateAnalysisRequest(request);
  if (!validated.ok) {
    throw new AnalysisApiError("VALIDATION_ERROR", validated.error, {
      retryable: false,
    });
  }
  if (validated.value.demo) return createDemoAnalysis(validated.value);

  const normalized = validateOptions(options);
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
    const result = await withRetry(
      async () => {
        if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
        let accessToken: string | undefined;
        try {
          accessToken = (options.accessToken ?? (await options.getAccessToken?.()))?.trim();
        } catch (error) {
          throw new AnalysisApiError(
            "AUTHENTICATION_REQUIRED",
            "A valid access token could not be obtained.",
            { retryable: false, cause: error },
          );
        }

        let response: Response;
        try {
          response = await fetch(getAnalysisEndpoint(options.baseUrl), {
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
          throw new AnalysisApiError(
            "NETWORK_ERROR",
            "Could not reach the analysis service.",
            { retryable: true, cause: error },
          );
        }

        const body = await readJson(response);
        if (!response.ok) {
          const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
          if (isAnalysisErrorResponse(body)) {
            throw new AnalysisApiError(body.error.code, body.error.message, {
              retryable: body.error.retryable,
              status: response.status,
              requestId: body.error.requestId,
              retryAfterMs,
            });
          }
          throw new AnalysisApiError(
            response.status === 401
              ? "AUTHENTICATION_REQUIRED"
              : response.status === 403
                ? "FORBIDDEN"
                : response.status === 429
                  ? "RATE_LIMITED"
                  : response.status >= 500
                    ? "SERVICE_UNAVAILABLE"
                    : "UPSTREAM_ERROR",
            "The analysis service returned an unexpected error.",
            {
              retryable: response.status === 429 || response.status >= 500,
              status: response.status,
              retryAfterMs,
            },
          );
        }

        const parsed = validateAnalysisResult(body);
        if (!parsed.ok) {
          throw new AnalysisApiError("INVALID_MODEL_RESPONSE", parsed.error, {
            retryable: true,
            status: response.status,
          });
        }
        return parsed.value;
      },
      {
        maxAttempts: normalized.maxAttempts,
        baseDelayMs: 300,
        maxDelayMs: 1_200,
        signal: controller.signal,
        shouldRetry,
      },
    );
    return result;
  } catch (caught) {
    let error: AnalysisApiError;
    if (didTimeout) {
      error = new AnalysisApiError("TIMEOUT", "Analysis timed out.", {
        retryable: true,
        cause: caught,
      });
    } else if (options.signal?.aborted) {
      error = new AnalysisApiError("CANCELLED", "Analysis was cancelled.", {
        retryable: false,
        cause: caught,
      });
    } else if (caught instanceof AnalysisApiError) {
      error = caught;
    } else {
      error = new AnalysisApiError(
        "NETWORK_ERROR",
        "Could not reach the analysis service.",
        { retryable: true, cause: caught },
      );
    }
    if (options.fallbackToDemo === true && shouldUseDemo(error)) {
      return createDemoAnalysis(validated.value);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}
