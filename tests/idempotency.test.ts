import assert from "node:assert/strict";
import test from "node:test";

import {
  claimIdempotency,
  completeIdempotency,
  releaseIdempotency,
  validateIdempotencyKey,
} from "@/lib/idempotency";

test("validates bounded idempotency keys", () => {
  assert.equal(validateIdempotencyKey("short"), null);
  assert.equal(validateIdempotencyKey("valid-operation-key-01"), "valid-operation-key-01");
  assert.equal(validateIdempotencyKey("invalid key with spaces"), null);
});

test("replays a completed local operation and rejects key reuse", async () => {
  const input = {
    key: "idempotency-test-key-0001",
    scope: "test-user-a",
    fingerprint: "fingerprint-a",
    environment: {},
    now: 1_000,
  };
  const first = await claimIdempotency(input);
  assert.equal(first.outcome, "claimed");
  if (first.outcome !== "claimed") return;
  const duplicate = await claimIdempotency({ ...input, now: 1_001 });
  assert.equal(duplicate.outcome, "in_progress");
  await completeIdempotency(first, { result: "ok" }, { now: 1_002 });
  const replay = await claimIdempotency({ ...input, now: 1_003 });
  assert.deepEqual(replay, { outcome: "replay", value: { result: "ok" } });
  const conflict = await claimIdempotency({
    ...input,
    fingerprint: "fingerprint-b",
    now: 1_004,
  });
  assert.equal(conflict.outcome, "conflict");
  await releaseIdempotency(first);
});
