import { isStrictProduction } from "@/lib/production-config";
import { hasDistributedState, redisCommand, sha256 } from "@/lib/redis-rest";

type Environment = Record<string, string | undefined>;

type ProcessingRecord = {
  state: "processing";
  fingerprint: string;
};

type CompleteRecord = {
  state: "complete";
  fingerprint: string;
  value: unknown;
};

type StoredRecord = ProcessingRecord | CompleteRecord;

export type IdempotencyClaim =
  | { outcome: "claimed"; storageKey: string; fingerprint: string; distributed: boolean }
  | { outcome: "replay"; value: unknown }
  | { outcome: "in_progress" }
  | { outcome: "conflict" };

type LocalEntry = { record: StoredRecord; expiresAt: number; lastSeenAt: number };
const localEntries = new Map<string, LocalEntry>();
const MAX_LOCAL_ENTRIES = 1_000;
const PROCESSING_TTL_SECONDS = 90;
const RESULT_TTL_SECONDS = 24 * 60 * 60;

export function validateIdempotencyKey(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim();
  return /^[A-Za-z0-9._:-]{16,128}$/.test(normalized) ? normalized : null;
}

function parseRecord(value: string | null): StoredRecord | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StoredRecord>;
    if (
      (parsed.state === "processing" || parsed.state === "complete") &&
      typeof parsed.fingerprint === "string" &&
      (parsed.state !== "complete" || "value" in parsed)
    ) {
      return parsed as StoredRecord;
    }
  } catch {
    // Corrupt cache entries are treated as misses after deletion by the caller.
  }
  return null;
}

function pruneLocal(now: number): void {
  for (const [key, entry] of localEntries) {
    if (entry.expiresAt <= now) localEntries.delete(key);
  }
  if (localEntries.size < MAX_LOCAL_ENTRIES) return;
  const oldest = [...localEntries.entries()].sort(
    (left, right) => left[1].lastSeenAt - right[1].lastSeenAt,
  )[0]?.[0];
  if (oldest) localEntries.delete(oldest);
}

async function storageKey(scope: string, key: string): Promise<string> {
  return `visionaid:idempotency:${await sha256(`${scope}:${key}`)}`;
}

export async function claimIdempotency(
  input: {
    key: string;
    scope: string;
    fingerprint: string;
    signal?: AbortSignal;
    now?: number;
    environment?: Environment;
  },
): Promise<IdempotencyClaim> {
  const environment = input.environment ?? process.env;
  const key = await storageKey(input.scope, input.key);
  const processing: ProcessingRecord = {
    state: "processing",
    fingerprint: input.fingerprint,
  };

  if (hasDistributedState(environment)) {
    const claimed = await redisCommand<string | null>(
      ["SET", key, JSON.stringify(processing), "NX", "EX", PROCESSING_TTL_SECONDS],
      { signal: input.signal, environment },
    );
    if (claimed === "OK") {
      return {
        outcome: "claimed",
        storageKey: key,
        fingerprint: input.fingerprint,
        distributed: true,
      };
    }
    const existingText = await redisCommand<string | null>(["GET", key], {
      signal: input.signal,
      environment,
    });
    const existing = parseRecord(existingText);
    if (!existing) {
      await redisCommand<number>(["DEL", key], { signal: input.signal, environment });
      return claimIdempotency(input);
    }
    if (existing.fingerprint !== input.fingerprint) return { outcome: "conflict" };
    return existing.state === "complete"
      ? { outcome: "replay", value: existing.value }
      : { outcome: "in_progress" };
  }

  if (isStrictProduction(environment)) {
    throw new Error("Distributed idempotency is required in production.");
  }
  const now = input.now ?? Date.now();
  pruneLocal(now);
  const existing = localEntries.get(key);
  if (existing && existing.expiresAt > now) {
    existing.lastSeenAt = now;
    if (existing.record.fingerprint !== input.fingerprint) return { outcome: "conflict" };
    return existing.record.state === "complete"
      ? { outcome: "replay", value: existing.record.value }
      : { outcome: "in_progress" };
  }
  localEntries.set(key, {
    record: processing,
    expiresAt: now + PROCESSING_TTL_SECONDS * 1_000,
    lastSeenAt: now,
  });
  return {
    outcome: "claimed",
    storageKey: key,
    fingerprint: input.fingerprint,
    distributed: false,
  };
}

export async function completeIdempotency(
  claim: Extract<IdempotencyClaim, { outcome: "claimed" }>,
  value: unknown,
  options: { signal?: AbortSignal; environment?: Environment; now?: number } = {},
): Promise<void> {
  const complete: CompleteRecord = {
    state: "complete",
    fingerprint: claim.fingerprint,
    value,
  };
  if (claim.distributed) {
    await redisCommand<string>(
      ["SET", claim.storageKey, JSON.stringify(complete), "EX", RESULT_TTL_SECONDS],
      { signal: options.signal, environment: options.environment },
    );
    return;
  }
  const now = options.now ?? Date.now();
  localEntries.set(claim.storageKey, {
    record: complete,
    expiresAt: now + RESULT_TTL_SECONDS * 1_000,
    lastSeenAt: now,
  });
}

export async function releaseIdempotency(
  claim: Extract<IdempotencyClaim, { outcome: "claimed" }>,
  options: { signal?: AbortSignal; environment?: Environment } = {},
): Promise<void> {
  if (claim.distributed) {
    await redisCommand<number>(["DEL", claim.storageKey], {
      signal: options.signal,
      environment: options.environment,
    });
    return;
  }
  localEntries.delete(claim.storageKey);
}
