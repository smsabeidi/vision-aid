import assert from "node:assert/strict";
import test from "node:test";

import { routeAnalysisRequest } from "@/lib/model-routing";

test("routes ordinary scene description to the balanced GPT-5.6 role", () => {
  const decision = routeAnalysisRequest({ mode: "describe", imageDataUrl: "unused" }, {});
  assert.equal(decision.route.model, "gpt-5.6-terra");
  assert.equal(decision.route.role, "balanced");
  assert.equal(decision.route.reasoningEffort, "none");
  assert.equal(decision.route.imageDetail, "high");
  assert.equal(decision.route.fallbackModel, "gpt-5.6-sol");
});

test("routes OCR and high-risk intent to flagship quality", () => {
  const read = routeAnalysisRequest({ mode: "read", imageDataUrl: "unused" }, {});
  const risky = routeAnalysisRequest(
    {
      mode: "describe",
      imageDataUrl: "unused",
      query: "Is it safe to cross the street now?",
    },
    {},
  );
  assert.equal(read.route.model, "gpt-5.6-sol");
  assert.equal(read.route.imageDetail, "original");
  assert.equal(risky.preflightSafety.level, "critical");
  assert.equal(risky.route.model, "gpt-5.6-sol");
  assert.equal(risky.route.role, "quality");
});

test("supports explicit per-mode release overrides with bounded numeric config", () => {
  const decision = routeAnalysisRequest(
    { mode: "find", imageDataUrl: "unused" },
    {
      OPENAI_MODEL_FIND: "model-release-candidate",
      OPENAI_TIMEOUT_MS_FIND: "12000",
      OPENAI_MAX_OUTPUT_TOKENS_FIND: "700",
      OPENAI_IMAGE_DETAIL_FIND: "low",
    },
  );
  assert.equal(decision.route.model, "model-release-candidate");
  assert.equal(decision.route.timeoutMs, 12_000);
  assert.equal(decision.route.maxOutputTokens, 700);
  assert.equal(decision.route.imageDetail, "low");
});
