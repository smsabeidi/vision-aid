import assert from "node:assert/strict";
import test from "node:test";

import {
  AnalysisApiError,
  analyzeImage,
  getAnalysisEndpoint,
} from "@/lib/analysis-client";

const VALID_IMAGE =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

test("builds same-origin and configured analysis endpoints", () => {
  assert.equal(getAnalysisEndpoint(""), "/api/v1/analyze");
  assert.equal(
    getAnalysisEndpoint("https://api.visionaid.example/"),
    "https://api.visionaid.example/api/v1/analyze",
  );
  assert.equal(
    getAnalysisEndpoint("https://api.visionaid.example/api/analyze"),
    "https://api.visionaid.example/api/analyze",
  );
});

test("explicit demo does not require an image or make a network request", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("fetch must not be called for an explicit demo");
  }) as typeof fetch;
  try {
    const result = await analyzeImage({ mode: "describe", demo: true });
    assert.equal(result.source, "demo");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("exposes a typed timeout when demo fallback is disabled", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      );
    })) as typeof fetch;
  try {
    await assert.rejects(
      analyzeImage(
        { mode: "read", imageDataUrl: VALID_IMAGE },
        { timeoutMs: 5, fallbackToDemo: false },
      ),
      (error: unknown) =>
        error instanceof AnalysisApiError &&
        error.code === "TIMEOUT" &&
        error.retryable,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("does not silently replace a live network failure with demo output", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new TypeError("network unavailable");
  }) as typeof fetch;
  try {
    await assert.rejects(
      analyzeImage(
        { mode: "find", imageDataUrl: VALID_IMAGE },
        { maxAttempts: 1 },
      ),
      (error: unknown) =>
        error instanceof AnalysisApiError && error.code === "NETWORK_ERROR",
    );
    const result = await analyzeImage(
      { mode: "find", imageDataUrl: VALID_IMAGE },
      { fallbackToDemo: true, maxAttempts: 1 },
    );
    assert.equal(result.source, "demo");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("retries a transient response with one stable idempotency key", async () => {
  const originalFetch = globalThis.fetch;
  const keys: string[] = [];
  let calls = 0;
  globalThis.fetch = (async (_input, init) => {
    calls += 1;
    keys.push(new Headers(init?.headers).get("idempotency-key") ?? "");
    if (calls === 1) {
      return Response.json(
        { error: { code: "SERVICE_UNAVAILABLE", message: "busy", retryable: true } },
        { status: 503 },
      );
    }
    return Response.json({
      requestId: "req-client-retry",
      mode: "describe",
      summary: "A desk is visible.",
      details: ["A mug is on the desk."],
      suggestedActions: ["Move slowly near the desk."],
      confidence: 0.8,
      safety: {
        level: "low",
        categories: ["none"],
        safeToAct: true,
        requiresHumanConfirmation: false,
        guidance: "Conditions can change.",
      },
      source: "ai",
      generatedAt: "2026-07-17T12:00:00.000Z",
    });
  }) as typeof fetch;
  try {
    const result = await analyzeImage(
      { mode: "describe", imageDataUrl: VALID_IMAGE },
      { idempotencyKey: "idem-client-retry-0001", requestId: "req-client-retry" },
    );
    assert.equal(result.source, "ai");
    assert.equal(calls, 2);
    assert.equal(keys[0], keys[1]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
