type Environment = Record<string, string | undefined>;
type RedisPrimitive = string | number;

export class RedisRestError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = "RedisRestError";
  }
}

function credentials(environment: Environment = process.env): {
  url?: string;
  token?: string;
} {
  return {
    url: environment.UPSTASH_REDIS_REST_URL?.trim().replace(/\/+$/, "") || undefined,
    token: environment.UPSTASH_REDIS_REST_TOKEN?.trim() || undefined,
  };
}

export function hasDistributedState(environment: Environment = process.env): boolean {
  const config = credentials(environment);
  if (!config.url || !config.token) return false;
  if (environment.VISIONAID_RUNTIME_ENV?.trim() !== "production") return true;
  try {
    return new URL(config.url).protocol === "https:";
  } catch {
    return false;
  }
}

export async function redisCommand<T>(
  command: [string, ...RedisPrimitive[]],
  options: {
    signal?: AbortSignal;
    environment?: Environment;
    fetchImplementation?: typeof fetch;
  } = {},
): Promise<T> {
  const config = credentials(options.environment);
  if (!config.url || !config.token || !hasDistributedState(options.environment)) {
    throw new RedisRestError("Distributed state is not configured.", false);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_500);
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    const response = await (options.fetchImplementation ?? fetch)(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      signal: controller.signal,
    });
    const body = (await response.json().catch(() => null)) as
      | { result?: T; error?: string }
      | null;
    if (!response.ok || !body || body.error) {
      throw new RedisRestError("Distributed state request failed.", response.status >= 500);
    }
    return body.result as T;
  } catch (error) {
    if (error instanceof RedisRestError) throw error;
    throw new RedisRestError("Distributed state is temporarily unavailable.", true);
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}

export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
