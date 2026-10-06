import assert from "node:assert/strict";
import test from "node:test";

import {
  clientRateLimitKey,
  createFixedWindowRateLimiter,
} from "@/lib/rate-limit";

test("limits each key within a fixed window and reports retry timing", () => {
  const limiter = createFixedWindowRateLimiter({
    limit: 2,
    windowMs: 10_000,
    maxEntries: 10,
  });

  assert.deepEqual(limiter.check("client-a", 1_000), {
    allowed: true,
    limit: 2,
    remaining: 1,
    resetAt: 11_000,
    retryAfterSeconds: 0,
  });
  assert.equal(limiter.check("client-a", 2_000).allowed, true);
  const blocked = limiter.check("client-a", 2_001);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.equal(blocked.retryAfterSeconds, 9);

  const reset = limiter.check("client-a", 11_000);
  assert.equal(reset.allowed, true);
  assert.equal(reset.remaining, 1);
});

test("keeps the in-memory map bounded", () => {
  const limiter = createFixedWindowRateLimiter({
    limit: 1,
    windowMs: 60_000,
    maxEntries: 2,
  });
  limiter.check("a", 100);
  limiter.check("b", 200);
  limiter.check("c", 300);
  assert.equal(limiter.entryCount, 2);
});

test("prefers trusted edge client IP headers and uses a conservative fallback", () => {
  assert.equal(
    clientRateLimitKey(
      new Headers({
        "cf-connecting-ip": "203.0.113.7",
        "x-vercel-forwarded-for": "198.51.100.2",
      }),
    ),
    "ip:203.0.113.7",
  );
  assert.equal(
    clientRateLimitKey(
      new Headers({ "x-vercel-forwarded-for": "2001:db8::1, 198.51.100.2" }),
    ),
    "ip:2001:db8::1",
  );
  assert.equal(
    clientRateLimitKey(new Headers({ "x-forwarded-for": "attacker-bucket" })),
    "ip:unknown",
  );
});
