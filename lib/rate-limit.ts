export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

export interface FixedWindowRateLimiter {
  check(key: string, now?: number): RateLimitDecision;
  /** Exposed for health checks and deterministic tests; contains no request content. */
  readonly entryCount: number;
}

export interface FixedWindowRateLimiterOptions {
  limit: number;
  windowMs: number;
  maxEntries: number;
}

type Entry = { count: number; resetAt: number; lastSeenAt: number };

function assertPositiveInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
}

/**
 * Best-effort process/isolate-local protection for an MVP. It bounds memory and
 * expires windows, but it is intentionally not presented as distributed abuse prevention.
 */
export function createFixedWindowRateLimiter(
  options: FixedWindowRateLimiterOptions,
): FixedWindowRateLimiter {
  assertPositiveInteger(options.limit, "limit");
  assertPositiveInteger(options.windowMs, "windowMs");
  assertPositiveInteger(options.maxEntries, "maxEntries");

  const entries = new Map<string, Entry>();

  function prune(now: number) {
    for (const [key, entry] of entries) {
      if (entry.resetAt <= now) entries.delete(key);
    }
  }

  function makeRoom(now: number) {
    prune(now);
    if (entries.size < options.maxEntries) return;

    let oldestKey: string | undefined;
    let oldestSeen = Number.POSITIVE_INFINITY;
    for (const [key, entry] of entries) {
      if (entry.lastSeenAt < oldestSeen) {
        oldestKey = key;
        oldestSeen = entry.lastSeenAt;
      }
    }
    if (oldestKey !== undefined) entries.delete(oldestKey);
  }

  return {
    check(rawKey: string, now = Date.now()) {
      const key = rawKey.trim().slice(0, 128) || "unknown";
      let entry = entries.get(key);
      if (!entry || entry.resetAt <= now) {
        if (!entry) makeRoom(now);
        entry = { count: 0, resetAt: now + options.windowMs, lastSeenAt: now };
        entries.set(key, entry);
      }

      entry.lastSeenAt = now;
      entry.count += 1;
      const remaining = Math.max(0, options.limit - entry.count);
      const allowed = entry.count <= options.limit;
      return {
        allowed,
        limit: options.limit,
        remaining,
        resetAt: entry.resetAt,
        retryAfterSeconds: allowed
          ? 0
          : Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
      };
    },
    get entryCount() {
      return entries.size;
    },
  };
}

const TRUSTED_CLIENT_IP_HEADERS = [
  "cf-connecting-ip",
  "x-vercel-forwarded-for",
  "fly-client-ip",
] as const;

function normalizeIp(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",", 1)[0]?.trim();
  if (!first || first.length > 64 || !/^[0-9a-f:.]+$/i.test(first)) return null;
  return first.toLowerCase();
}

/** Uses only edge-provider headers expected to be overwritten by the hosting layer. */
export function clientRateLimitKey(headers: Headers): string {
  for (const header of TRUSTED_CLIENT_IP_HEADERS) {
    const ip = normalizeIp(headers.get(header));
    if (ip) return `ip:${ip}`;
  }
  // A shared fallback is deliberately conservative: missing trusted metadata cannot
  // manufacture unbounded attacker-controlled buckets.
  return "ip:unknown";
}

const distributedScript = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
return {current, ttl}
`.trim();

const localProductionFallback = createFixedWindowRateLimiter({
  limit: 20,
  windowMs: 60_000,
  maxEntries: 2_000,
});

export class RateLimitConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitConfigurationError";
  }
}

export async function checkAnalysisRateLimit(
  rawKey: string,
  options: {
    signal?: AbortSignal;
    now?: number;
    environment?: Record<string, string | undefined>;
  } = {},
): Promise<RateLimitDecision> {
  const environment = options.environment ?? process.env;
  const limit = 20;
  const windowMs = 60_000;
  const now = options.now ?? Date.now();
  if (!hasDistributedState(environment)) {
    if (isStrictProduction(environment)) {
      throw new RateLimitConfigurationError(
        "Distributed rate limiting is required in production.",
      );
    }
    return localProductionFallback.check(rawKey, now);
  }

  const keyHash = await sha256(rawKey.trim().slice(0, 256) || "unknown");
  const result = await redisCommand<[number | string, number | string]>(
    ["EVAL", distributedScript, 1, `visionaid:ratelimit:${keyHash}`, windowMs],
    { signal: options.signal, environment },
  );
  const count = Number(result[0]);
  const ttl = Math.max(1, Number(result[1]));
  if (!Number.isFinite(count) || !Number.isFinite(ttl)) {
    throw new RateLimitConfigurationError("Distributed rate limiting returned invalid data.");
  }
  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt: now + ttl,
    retryAfterSeconds: count <= limit ? 0 : Math.max(1, Math.ceil(ttl / 1_000)),
  };
}
import { isStrictProduction } from "@/lib/production-config";
import { hasDistributedState, redisCommand, sha256 } from "@/lib/redis-rest";
