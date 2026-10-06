import assert from "node:assert/strict";
import test from "node:test";

import { CircuitBreaker, parseRetryAfter, withRetry } from "@/lib/resilience";

test("retries only the configured number of times", async () => {
  let attempts = 0;
  const result = await withRetry(
    async () => {
      attempts += 1;
      if (attempts < 3) throw Object.assign(new Error("temporary"), { retryable: true });
      return "ok";
    },
    {
      maxAttempts: 3,
      baseDelayMs: 0,
      maxDelayMs: 0,
      random: () => 0,
      shouldRetry: (error) =>
        typeof error === "object" && error !== null && "retryable" in error,
    },
  );
  assert.equal(result, "ok");
  assert.equal(attempts, 3);
});

test("opens and half-opens a failing provider circuit", () => {
  const circuit = new CircuitBreaker(2, 1_000);
  circuit.recordFailure(100);
  assert.equal(circuit.allowRequest(101), true);
  circuit.recordFailure(200);
  assert.equal(circuit.getState(201), "open");
  assert.equal(circuit.allowRequest(201), false);
  assert.equal(circuit.allowRequest(1_200), true);
  assert.equal(circuit.allowRequest(1_201), false);
  circuit.recordSuccess();
  assert.equal(circuit.getState(1_202), "closed");
});

test("parses bounded Retry-After values", () => {
  assert.equal(parseRetryAfter("2"), 2_000);
  assert.equal(parseRetryAfter("999"), 10_000);
  assert.equal(parseRetryAfter("invalid"), 0);
});
