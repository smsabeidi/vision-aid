import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "@/app/api/analyze+api";
import { handleAnalyze } from "@/lib/analyze-api";
import type { AnalysisResult } from "@/types/analysis";

test("API route supports a camera-independent explicit demo without caching", async () => {
  const response = await POST(
    new Request("https://vision-aid.test/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "CF-Connecting-IP": "203.0.113.101",
      },
      body: JSON.stringify({ mode: "describe", demo: true }),
    }),
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.equal(response.headers.get("x-api-version"), "v1");
  assert.equal(response.headers.get("deprecation"), "true");
  const body = (await response.json()) as AnalysisResult;
  assert.equal(body.source, "demo");
  assert.equal(body.mode, "describe");
  assert.equal(body.requestId, response.headers.get("x-request-id"));
});

test("API route rejects non-JSON input before analysis", async () => {
  const response = await POST(
    new Request("https://vision-aid.test/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "CF-Connecting-IP": "203.0.113.102",
      },
      body: "not json",
    }),
  );
  assert.equal(response.status, 415);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, "UNSUPPORTED_MEDIA_TYPE");
});

test("live analysis fails closed when the provider credential is absent", async () => {
  const response = await handleAnalyze(
    new Request("https://vision-aid.test/api/v1/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "missing-provider-key-0001",
        "CF-Connecting-IP": "203.0.113.103",
      },
      body: JSON.stringify({
        mode: "describe",
        imageDataUrl:
          "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
      }),
    }),
    { AUTH_REQUIRED: "false" },
  );
  assert.equal(response.status, 503);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, "CONFIGURATION_ERROR");
});

test("strict production rejects missing identity before accepting work", async () => {
  const response = await handleAnalyze(
    new Request("https://vision-aid.test/api/v1/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "describe", demo: true }),
    }),
    { VISIONAID_RUNTIME_ENV: "production", AUTH_REQUIRED: "false" },
  );
  assert.equal(response.status, 401);
  assert.match(response.headers.get("www-authenticate") ?? "", /Bearer/);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, "AUTHENTICATION_REQUIRED");
});
