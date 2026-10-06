import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_IMAGE_BYTES,
  decodedBase64Length,
  validateAnalysisRequest,
  validateImageDataUrl,
} from "@/lib/analysis-validation";

const SMALL_IMAGE =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

test("validates and normalizes an analysis request", () => {
  const result = validateAnalysisRequest({
    imageDataUrl: SMALL_IMAGE,
    mode: "find",
    query: "  my keys  ",
    demo: false,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value, {
      imageDataUrl: SMALL_IMAGE,
      mode: "find",
      query: "my keys",
    });
  }
});

test("allows a camera-independent forced demo and normalizes the alias", () => {
  assert.deepEqual(validateAnalysisRequest({ mode: "describe", demo: true }), {
    ok: true,
    value: { mode: "describe", demo: true },
  });
  assert.deepEqual(validateAnalysisRequest({ mode: "read", forceDemo: true }), {
    ok: true,
    value: { mode: "read", demo: true },
  });
  assert.equal(
    validateAnalysisRequest({ mode: "read", demo: true, forceDemo: false }).ok,
    false,
  );
  assert.equal(validateAnalysisRequest({ mode: "read" }).ok, false);
});

test("rejects unsupported fields and modes", () => {
  assert.equal(
    validateAnalysisRequest({
      imageDataUrl: SMALL_IMAGE,
      mode: "diagnose",
    }).ok,
    false,
  );
  assert.equal(
    validateAnalysisRequest({
      imageDataUrl: SMALL_IMAGE,
      mode: "read",
      apiKey: "must-not-be-accepted",
    }).ok,
    false,
  );
});

test("accepts only supported base64 image data URLs", () => {
  assert.equal(validateImageDataUrl(SMALL_IMAGE).ok, true);
  assert.equal(validateImageDataUrl("https://example.com/private.jpg").ok, false);
  assert.equal(validateImageDataUrl("data:image/svg+xml;base64,PHN2Zz4=").ok, false);
  assert.equal(validateImageDataUrl("data:image/jpeg;base64,not base64").ok, false);
  assert.equal(validateImageDataUrl("data:image/jpeg;base64,AQI").ok, false);
  assert.equal(validateImageDataUrl("data:image/png;base64,/9j/4AAQSkZJRg==").ok, false);
});

test("computes decoded size and rejects oversized images", () => {
  assert.equal(decodedBase64Length("AQID"), 3);
  assert.equal(decodedBase64Length("AQI="), 2);
  assert.equal(decodedBase64Length("AQ=="), 1);
  assert.equal(decodedBase64Length("AQI"), -1);

  const encodedLength = Math.ceil((MAX_IMAGE_BYTES + 1) / 3) * 4;
  const oversized = `data:image/jpeg;base64,${"A".repeat(encodedLength)}`;
  assert.equal(validateImageDataUrl(oversized).ok, false);
});
