export interface RetryableError extends Error {
  retryable?: boolean;
  retryAfterMs?: number;
}

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  signal?: AbortSignal;
  random?: () => number;
  onRetry?: (context: { attempt: number; delayMs: number; error: unknown }) => void;
  shouldRetry: (error: unknown) => boolean;
}

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

export async function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw abortError();
  await new Promise<void>((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout>;
    const cleanup = () => signal?.removeEventListener("abort", onAbort);
    const onAbort = () => {
      clearTimeout(timeout);
      cleanup();
      reject(abortError());
    };
    timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function withRetry<T>(
  operation: (context: { attempt: number }) => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  if (!Number.isSafeInteger(options.maxAttempts) || options.maxAttempts < 1) {
    throw new Error("maxAttempts must be a positive integer.");
  }

  const random = options.random ?? Math.random;
  let lastError: unknown;
  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    if (options.signal?.aborted) throw abortError();
    try {
      return await operation({ attempt });
    } catch (error) {
      lastError = error;
      if (attempt >= options.maxAttempts || !options.shouldRetry(error)) throw error;
      const retryAfter =
        typeof error === "object" &&
        error !== null &&
        "retryAfterMs" in error &&
        typeof error.retryAfterMs === "number"
          ? error.retryAfterMs
          : 0;
      const exponential = Math.min(
        options.maxDelayMs,
        options.baseDelayMs * 2 ** (attempt - 1),
      );
      const jittered = Math.min(
        options.maxDelayMs,
        Math.round(exponential * (0.5 + random())),
      );
      const delayMs = Math.max(retryAfter, jittered);
      options.onRetry?.({ attempt, delayMs, error });
      await abortableDelay(delayMs, options.signal);
    }
  }
  throw lastError;
}

export type CircuitState = "closed" | "open" | "half-open";

export class CircuitBreaker {
  private failures = 0;
  private openedUntil = 0;
  private probeInFlight = false;

  constructor(
    private readonly failureThreshold: number,
    private readonly cooldownMs: number,
  ) {
    if (!Number.isSafeInteger(failureThreshold) || failureThreshold < 1) {
      throw new Error("failureThreshold must be a positive integer.");
    }
    if (!Number.isSafeInteger(cooldownMs) || cooldownMs < 1) {
      throw new Error("cooldownMs must be a positive integer.");
    }
  }

  getState(now = Date.now()): CircuitState {
    if (this.openedUntil === 0) return "closed";
    return now < this.openedUntil ? "open" : "half-open";
  }

  allowRequest(now = Date.now()): boolean {
    const state = this.getState(now);
    if (state === "closed") return true;
    if (state === "open" || this.probeInFlight) return false;
    this.probeInFlight = true;
    return true;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openedUntil = 0;
    this.probeInFlight = false;
  }

  recordFailure(now = Date.now()): void {
    this.probeInFlight = false;
    this.failures += 1;
    if (this.failures >= this.failureThreshold || this.openedUntil > 0) {
      this.openedUntil = now + this.cooldownMs;
    }
  }

  recordCancellation(): void {
    this.probeInFlight = false;
  }
}

export function parseRetryAfter(value: string | null, now = Date.now()): number {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(10_000, seconds * 1_000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.min(10_000, Math.max(0, date - now)) : 0;
}
