import assert from "node:assert/strict";
import test from "node:test";

import { analyzeWithNvidia, buildNvidiaRequest } from "@/lib/nvidia-analysis";
import { analyzeWithVisionProvider } from "@/lib/vision-analysis";
import { VisionProviderError } from "@/lib/vision-provider";

const VALID_IMAGE =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

const MODEL_RESULT = {
  summary: "A mug is on a desk.",
  details: ["The mug is slightly right of center."],
  suggestedActions: ["Move slowly near the desk."],
  confidence: 0.86,
  detectedRisks: [],
  objects: [
    {
      label: "mug",
      confidence: 0.9,
      boundingBox: { xMin: 0.55, yMin: 0.29, xMax: 0.72, yMax: 0.7 },
      evidence: "A handled cup is visible on the desk.",
    },
  ],
};

test("builds a strict Cosmos 3 multimodal grounding request", () => {
  const body = buildNvidiaRequest(
    { mode: "find", query: "mug", imageDataUrl: VALID_IMAGE },
    "nvidia/cosmos3-nano-reasoner",
  ) as {
    model: string;
    messages: Array<{ content: unknown }>;
    response_format: { type: string; json_schema: { strict: boolean; schema: object } };
  };
  assert.equal(body.model, "nvidia/cosmos3-nano-reasoner");
  assert.equal(body.response_format.type, "json_schema");
  assert.equal(body.response_format.json_schema.strict, true);
  assert.match(JSON.stringify(body.messages), /image_url/);
  assert.match(JSON.stringify(body.response_format.json_schema.schema), /boundingBox/);
});

test("retries a transient Cosmos failure and returns grounded objects", async () => {
  let calls = 0;
  const urls: string[] = [];
  const fetchImplementation: typeof fetch = async (input, init) => {
    calls += 1;
    urls.push(String(input));
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-key");
    if (calls === 1) return new Response("busy", { status: 503 });
    return Response.json(
      { choices: [{ message: { content: JSON.stringify(MODEL_RESULT) } }] },
      { headers: { "x-request-id": "cosmos-provider-123" } },
    );
  };

  const outcome = await analyzeWithNvidia(
    { mode: "describe", imageDataUrl: VALID_IMAGE },
    "req-cosmos-test",
    new AbortController().signal,
    {
      environment: {
        NVIDIA_COSMOS_BASE_URL: "https://cosmos.test/v1",
        NVIDIA_COSMOS_API_KEY: "test-key",
      },
      fetchImplementation,
    },
  );

  assert.equal(calls, 2);
  assert.deepEqual(urls, [
    "https://cosmos.test/v1/chat/completions",
    "https://cosmos.test/v1/chat/completions",
  ]);
  assert.equal(outcome.provider, "nvidia");
  assert.equal(outcome.modelRole, "perception");
  assert.equal(outcome.providerRequestId, "cosmos-provider-123");
  assert.equal(outcome.result.objects?.[0]?.label, "mug");
});

test("production Cosmos configuration requires HTTPS and service authentication", async () => {
  await assert.rejects(
    analyzeWithNvidia(
      { mode: "describe", imageDataUrl: VALID_IMAGE },
      "req-cosmos-config",
      new AbortController().signal,
      {
        environment: {
          VISIONAID_RUNTIME_ENV: "production",
          NVIDIA_COSMOS_BASE_URL: "http://cosmos.test",
        },
      },
    ),
    (error: unknown) =>
      error instanceof VisionProviderError && error.code === "CONFIGURATION_ERROR",
  );
});

test("fails closed on an unsupported provider selector", async () => {
  await assert.rejects(
    analyzeWithVisionProvider(
      { mode: "describe", imageDataUrl: VALID_IMAGE },
      "req-provider-selector",
      new AbortController().signal,
      { environment: { VISION_PROVIDER: "typo-provider" } },
    ),
    (error: unknown) =>
      error instanceof VisionProviderError && error.code === "CONFIGURATION_ERROR",
  );
});
