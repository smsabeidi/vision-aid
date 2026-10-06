import assert from "node:assert/strict";
import test from "node:test";

import {
  SYSTEM_INSTRUCTIONS,
  analyzeWithOpenAI,
  buildOpenAIRequest,
} from "@/lib/openai-analysis";
import { routeAnalysisRequest } from "@/lib/model-routing";

const VALID_IMAGE =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

test("builds a non-stored, strict structured request with explicit vision budgets", () => {
  const request = { mode: "read" as const, imageDataUrl: VALID_IMAGE };
  const route = routeAnalysisRequest(request, {}).route;
  const body = buildOpenAIRequest(request, route);
  assert.equal(body.store, false);
  assert.equal(body.model, "gpt-5.6-sol");
  assert.equal(body.reasoning.effort, "low");
  assert.equal(body.input[0].content[1].type, "input_image");
  assert.equal("detail" in body.input[0].content[1] && body.input[0].content[1].detail, "original");
  assert.equal(body.text.format.strict, true);
  assert.match(SYSTEM_INSTRUCTIONS, /untrusted data/i);
});

test("retries balanced analysis on flagship with the same typed contract", async () => {
  const models: string[] = [];
  let calls = 0;
  const fetchImplementation: typeof fetch = async (_input, init) => {
    calls += 1;
    const body = JSON.parse(String(init?.body)) as { model: string };
    models.push(body.model);
    if (calls === 1) return new Response("busy", { status: 500 });
    return Response.json(
      {
        output_text: JSON.stringify({
          summary: "A desk is visible.",
          details: ["A mug is on the desk."],
          suggestedActions: ["Move slowly near the desk."],
          confidence: 0.82,
          detectedRisks: [],
          objects: [
            {
              label: "mug",
              confidence: 0.88,
              boundingBox: { xMin: 0.57, yMin: 0.31, xMax: 0.73, yMax: 0.69 },
              evidence: "A mug is visible on the desk.",
            },
          ],
        }),
        usage: { input_tokens: 100, output_tokens: 40 },
      },
      { headers: { "x-request-id": "provider-123" } },
    );
  };
  const result = await analyzeWithOpenAI(
    { mode: "describe", imageDataUrl: VALID_IMAGE },
    "req-openai-test",
    new AbortController().signal,
    { environment: { OPENAI_API_KEY: "test-key" }, fetchImplementation },
  );
  assert.deepEqual(models, ["gpt-5.6-terra", "gpt-5.6-sol"]);
  assert.equal(result.attempts, 2);
  assert.equal(result.result.source, "ai");
  assert.equal(result.providerRequestId, "provider-123");
});
