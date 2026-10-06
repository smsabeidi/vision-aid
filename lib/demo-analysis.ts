import { assessSafety, enforceSafetyPolicy } from "@/lib/safety";
import type { AnalysisRequest, AnalysisResult } from "@/types/analysis";

const DEMO_GENERATED_AT = "2026-07-17T12:00:00.000Z";

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

export function createDemoAnalysis(request: AnalysisRequest): AnalysisResult {
  const target = request.query?.trim() || "the item you asked about";
  const safety = assessSafety({ mode: request.mode, query: request.query });

  const content = {
    describe: {
      summary:
        "A bright kitchen counter is in front of you with a mug, a cereal box, and a set of keys.",
      details: [
        "The mug is near the center, about an arm's length away.",
        "The keys are to the right of the mug.",
        "The counter edge runs across the lower part of the view.",
      ],
      suggestedActions: ["Move slowly and keep one hand near the counter edge."],
      confidence: 0.91,
    },
    read: {
      summary: "Visible text: OAT MILK — Original — Keep refrigerated.",
      details: [
        "The largest text reads “OAT MILK.”",
        "A smaller line reads “Original.”",
        "Storage text reads “Keep refrigerated.”",
      ],
      suggestedActions: ["Move the camera closer if you want the small print read."],
      confidence: 0.96,
    },
    find: {
      summary: `${target} appears to be on the counter, slightly right of center.`,
      details: [
        "It is beside the mug and in front of the cereal box.",
        "It appears to be within arm's reach, but depth can be misjudged from one image.",
      ],
      suggestedActions: ["Reach slowly from the front edge of the counter toward the right."],
      confidence: 0.88,
    },
  }[request.mode];

  return enforceSafetyPolicy({
    requestId: `demo-${stableHash(`${request.mode}:${target.toLowerCase()}`)}`,
    mode: request.mode,
    ...content,
    safety,
    source: "demo",
    generatedAt: DEMO_GENERATED_AT,
  });
}
