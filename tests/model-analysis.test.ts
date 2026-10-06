import assert from "node:assert/strict";
import test from "node:test";

import {
  extractResponseText,
  parseModelAnalysis,
  parseOpenAIAnalysisResponse,
} from "@/lib/model-analysis";

const validModelResult = {
  summary: "A set of keys is on the table.",
  details: ["The keys are slightly right of center."],
  suggestedActions: ["Reach slowly toward the right side of the table."],
  confidence: 0.87,
  detectedRisks: [],
  objects: [
    {
      label: "keys",
      confidence: 0.91,
      boundingBox: { xMin: 0.54, yMin: 0.42, xMax: 0.71, yMax: 0.61 },
      evidence: "A metal key ring is visible slightly right of center.",
    },
  ],
};

test("extracts output text from a Responses API message", () => {
  const text = extractResponseText({
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(validModelResult) }],
      },
    ],
  });
  assert.equal(text, JSON.stringify(validModelResult));
});

test("strictly validates model JSON", () => {
  assert.deepEqual(parseModelAnalysis(validModelResult), validModelResult);
  assert.equal(parseModelAnalysis({ ...validModelResult, confidence: 2 }), null);
  assert.equal(parseModelAnalysis({ ...validModelResult, unexpected: true }), null);
  assert.equal(
    parseModelAnalysis({ ...validModelResult, detectedRisks: ["made_up"] }),
    null,
  );
});

test("builds a safe domain result from structured output", () => {
  const result = parseOpenAIAnalysisResponse(
    { output_text: JSON.stringify(validModelResult) },
    {
      imageDataUrl: "data:image/jpeg;base64,AQID",
      mode: "find",
      query: "keys",
    },
    "req-123",
    new Date("2026-07-17T12:00:00.000Z"),
  );
  assert.ok(result);
  assert.equal(result.requestId, "req-123");
  assert.equal(result.source, "ai");
  assert.equal(result.safety.level, "low");
});

test("rejects malformed or non-JSON model output", () => {
  assert.equal(
    parseOpenAIAnalysisResponse(
      { output_text: "not json" },
      { imageDataUrl: "data:image/jpeg;base64,AQID", mode: "describe" },
      "req-123",
    ),
    null,
  );
});
