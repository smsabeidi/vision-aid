import { assessSafety, enforceSafetyPolicy } from "@/lib/safety";
import type {
  AnalysisRequest,
  AnalysisResult,
  SafetyCategory,
} from "@/types/analysis";

export const MODEL_ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    details: {
      type: "array",
      maxItems: 12,
      items: { type: "string" },
    },
    suggestedActions: {
      type: "array",
      maxItems: 8,
      items: { type: "string" },
    },
    objects: {
      type: "array",
      maxItems: 25,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          boundingBox: {
            type: "object",
            additionalProperties: false,
            properties: {
              xMin: { type: "number", minimum: 0, maximum: 1 },
              yMin: { type: "number", minimum: 0, maximum: 1 },
              xMax: { type: "number", minimum: 0, maximum: 1 },
              yMax: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["xMin", "yMin", "xMax", "yMax"],
          },
          evidence: { type: "string" },
        },
        required: ["label", "confidence", "boundingBox", "evidence"],
      },
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    detectedRisks: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "navigation",
          "medical",
          "medication",
          "financial",
          "legal",
          "emergency",
          "identity",
        ],
      },
    },
  },
  required: [
    "summary",
    "details",
    "suggestedActions",
    "objects",
    "confidence",
    "detectedRisks",
  ],
} as const;

type ModelAnalysis = {
  summary: string;
  details: string[];
  suggestedActions: string[];
  objects: Array<{
    label: string;
    confidence: number;
    boundingBox: { xMin: number; yMin: number; xMax: number; yMax: number };
    evidence: string;
  }>;
  confidence: number;
  detectedRisks: Exclude<SafetyCategory, "none">[];
};

const MODEL_RISK_CATEGORIES = new Set([
  "navigation",
  "medical",
  "medication",
  "financial",
  "legal",
  "emergency",
  "identity",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanStringArray(
  value: unknown,
  maxItems: number,
  maxLength: number,
): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  if (
    value.some(
      (item) =>
        typeof item !== "string" ||
        item.trim().length === 0 ||
        item.length > maxLength,
    )
  ) {
    return null;
  }
  return value.map((item) => item.trim());
}

function cleanObjects(value: unknown): ModelAnalysis["objects"] | null {
  if (!Array.isArray(value) || value.length > 25) return null;
  const objects: ModelAnalysis["objects"] = [];
  for (const item of value) {
    if (!isRecord(item) || !isRecord(item.boundingBox)) return null;
    const box = item.boundingBox;
    const coordinates = [box.xMin, box.yMin, box.xMax, box.yMax];
    if (
      Object.keys(item).some(
        (key) => !["label", "confidence", "boundingBox", "evidence"].includes(key),
      ) ||
      Object.keys(box).some(
        (key) => !["xMin", "yMin", "xMax", "yMax"].includes(key),
      ) ||
      typeof item.label !== "string" ||
      item.label.trim().length === 0 ||
      item.label.length > 120 ||
      typeof item.evidence !== "string" ||
      item.evidence.trim().length === 0 ||
      item.evidence.length > 300 ||
      typeof item.confidence !== "number" ||
      !Number.isFinite(item.confidence) ||
      item.confidence < 0 ||
      item.confidence > 1 ||
      coordinates.some(
        (coordinate) =>
          typeof coordinate !== "number" ||
          !Number.isFinite(coordinate) ||
          coordinate < 0 ||
          coordinate > 1,
      ) ||
      (box.xMin as number) >= (box.xMax as number) ||
      (box.yMin as number) >= (box.yMax as number)
    ) {
      return null;
    }
    objects.push({
      label: item.label.trim(),
      confidence: item.confidence,
      boundingBox: {
        xMin: box.xMin as number,
        yMin: box.yMin as number,
        xMax: box.xMax as number,
        yMax: box.yMax as number,
      },
      evidence: item.evidence.trim(),
    });
  }
  return objects;
}

export function parseModelAnalysis(value: unknown): ModelAnalysis | null {
  if (!isRecord(value)) return null;
  const allowedKeys = new Set([
    "summary",
    "details",
    "suggestedActions",
    "objects",
    "confidence",
    "detectedRisks",
  ]);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) return null;

  const details = cleanStringArray(value.details, 12, 600);
  const actions = cleanStringArray(value.suggestedActions, 8, 500);
  const objects = cleanObjects(value.objects);
  if (
    typeof value.summary !== "string" ||
    value.summary.trim().length === 0 ||
    value.summary.length > 1000 ||
    !details ||
    !actions ||
    !objects ||
    typeof value.confidence !== "number" ||
    !Number.isFinite(value.confidence) ||
    value.confidence < 0 ||
    value.confidence > 1 ||
    !Array.isArray(value.detectedRisks) ||
    value.detectedRisks.some(
      (item) => typeof item !== "string" || !MODEL_RISK_CATEGORIES.has(item),
    )
  ) {
    return null;
  }

  return {
    summary: value.summary.trim(),
    details,
    suggestedActions: actions,
    objects,
    confidence: value.confidence,
    detectedRisks: [...new Set(value.detectedRisks)] as ModelAnalysis["detectedRisks"],
  };
}

export function extractResponseText(value: unknown): string | null {
  if (!isRecord(value)) return null;
  if (typeof value.output_text === "string" && value.output_text.trim()) {
    return value.output_text.trim();
  }

  if (!Array.isArray(value.output)) return null;
  const texts: string[] = [];
  for (const item of value.output) {
    if (!isRecord(item) || item.type !== "message" || !Array.isArray(item.content)) {
      continue;
    }
    for (const content of item.content) {
      if (
        isRecord(content) &&
        content.type === "output_text" &&
        typeof content.text === "string"
      ) {
        texts.push(content.text);
      }
    }
  }
  return texts.length > 0 ? texts.join("\n").trim() : null;
}

export function parseOpenAIAnalysisResponse(
  response: unknown,
  request: AnalysisRequest,
  requestId: string,
  now = new Date(),
): AnalysisResult | null {
  const text = extractResponseText(response);
  if (!text) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  const model = parseModelAnalysis(parsed);
  if (!model) return null;

  const safety = assessSafety({
    mode: request.mode,
    query: request.query,
    modelText: [model.summary, ...model.details, ...model.suggestedActions].join("\n"),
    modelCategories: model.detectedRisks,
  });

  return enforceSafetyPolicy({
    requestId,
    mode: request.mode,
    summary: model.summary,
    details: model.details,
    suggestedActions: model.suggestedActions,
    objects: model.objects,
    confidence: model.confidence,
    safety,
    source: "ai",
    generatedAt: now.toISOString(),
  });
}
