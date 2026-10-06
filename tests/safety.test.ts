import assert from "node:assert/strict";
import test from "node:test";

import { assessSafety, enforceSafetyPolicy } from "@/lib/safety";
import type { AnalysisResult } from "@/types/analysis";

test("allows ordinary low-risk visual assistance with a standing caveat", () => {
  const safety = assessSafety({ mode: "find", query: "Where are my keys?" });
  assert.equal(safety.level, "low");
  assert.deepEqual(safety.categories, ["none"]);
  assert.equal(safety.safeToAct, true);
  assert.equal(safety.requiresHumanConfirmation, false);
});

test("classifies a street-crossing verdict as critical", () => {
  const safety = assessSafety({
    mode: "describe",
    query: "Is it safe to cross the street now?",
  });
  assert.equal(safety.level, "critical");
  assert.ok(safety.categories.includes("navigation"));
  assert.equal(safety.safeToAct, false);
  assert.equal(safety.requiresHumanConfirmation, true);
});

test("classifies dosing and diagnostic requests as high risk", () => {
  const medication = assessSafety({
    mode: "read",
    query: "What dosage should I take from this prescription?",
  });
  const medical = assessSafety({
    mode: "describe",
    query: "Can you diagnose this rash and tell me how to treat it?",
  });
  assert.equal(medication.level, "high");
  assert.ok(medication.categories.includes("medication"));
  assert.equal(medical.level, "high");
  assert.ok(medical.categories.includes("medical"));
});

test("uses model risk categories even when the query is innocuous", () => {
  const safety = assessSafety({
    mode: "describe",
    modelCategories: ["emergency"],
  });
  assert.equal(safety.level, "critical");
  assert.ok(safety.categories.includes("emergency"));
});

test("safety enforcement removes action advice for an immediate hazard", () => {
  const result: AnalysisResult = {
    requestId: "test",
    mode: "describe",
    summary: "The road appears clear, so cross now.",
    details: ["A road is visible."],
    suggestedActions: ["Cross now."],
    confidence: 0.9,
    safety: assessSafety({
      mode: "describe",
      query: "Can I cross the road now?",
    }),
    source: "ai",
    generatedAt: "2026-07-17T12:00:00.000Z",
  };

  const safe = enforceSafetyPolicy(result);
  assert.match(safe.summary, /cannot verify/i);
  assert.equal(safe.suggestedActions.length, 1);
  assert.doesNotMatch(safe.suggestedActions[0], /cross now/i);
});
