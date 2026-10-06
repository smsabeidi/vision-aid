import assert from "node:assert/strict";
import test from "node:test";

import { createDemoAnalysis } from "@/lib/demo-analysis";
import type { AnalysisRequest } from "@/types/analysis";

const request: AnalysisRequest = {
  mode: "find",
  query: "blue mug",
  demo: true,
};

test("demo analysis is deterministic and clearly labelled", () => {
  const first = createDemoAnalysis(request);
  const second = createDemoAnalysis({ ...request });
  assert.deepEqual(first, second);
  assert.equal(first.source, "demo");
  assert.match(first.requestId, /^demo-/);
  assert.match(first.summary, /blue mug/i);
});

test("demo mode applies the same high-stakes policy as live AI", () => {
  const result = createDemoAnalysis({
    ...request,
    mode: "describe",
    query: "Is it safe to cross the street now?",
  });
  assert.equal(result.safety.level, "critical");
  assert.equal(result.safety.safeToAct, false);
  assert.match(result.summary, /cannot verify/i);
});

test("all demo modes return useful contract-complete content", () => {
  for (const mode of ["describe", "read", "find"] as const) {
    const result = createDemoAnalysis({ ...request, mode });
    assert.equal(result.mode, mode);
    assert.ok(result.summary.length > 0);
    assert.ok(result.details.length > 0);
    assert.ok(result.suggestedActions.length > 0);
    assert.ok(result.confidence >= 0 && result.confidence <= 1);
  }
});
