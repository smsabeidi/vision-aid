import {
  ANALYSIS_ERROR_CODES,
  ANALYSIS_MODES,
  RISK_LEVELS,
  SAFETY_CATEGORIES,
  type AnalysisErrorCode,
  type AnalysisErrorResponse,
  type AnalysisRequest,
  type AnalysisResult,
  type RiskLevel,
  type SafetyAssessment,
  type SafetyCategory,
} from "@/types/analysis";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_JSON_BODY_BYTES = 7 * 1024 * 1024;
export const MAX_QUERY_LENGTH = 500;

const DATA_URL_PATTERN =
  /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/;
const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

type ValidationSuccess<T> = { ok: true; value: T };
type ValidationFailure = { ok: false; error: string };
export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isOneOf<T extends readonly string[]>(
  value: unknown,
  choices: T,
): value is T[number] {
  return typeof value === "string" && choices.includes(value as T[number]);
}

function validateStringArray(
  value: unknown,
  field: string,
  maxItems: number,
  maxLength: number,
): ValidationResult<string[]> {
  if (!Array.isArray(value) || value.length > maxItems) {
    return { ok: false, error: `${field} must be an array of at most ${maxItems} items.` };
  }

  if (
    value.some(
      (item) =>
        typeof item !== "string" ||
        item.trim().length === 0 ||
        item.length > maxLength,
    )
  ) {
    return {
      ok: false,
      error: `${field} contains an empty, non-text, or overlong item.`,
    };
  }

  return { ok: true, value: value.map((item) => item.trim()) };
}

export function decodedBase64Length(base64: string): number {
  if (base64.length === 0 || base64.length % 4 !== 0) {
    return -1;
  }

  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return (base64.length / 4) * 3 - padding;
}

function decodeBase64Prefix(base64: string, byteCount = 12): number[] {
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const character of base64) {
    if (character === "=" || bytes.length >= byteCount) break;
    const value = BASE64_ALPHABET.indexOf(character);
    if (value < 0) return [];
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >>> bits) & 0xff);
      buffer &= (1 << bits) - 1;
    }
  }
  return bytes;
}

function hasExpectedImageSignature(mimeType: string, base64: string): boolean {
  const bytes = decodeBase64Prefix(base64);
  const startsWith = (...signature: number[]) =>
    signature.every((value, index) => bytes[index] === value);

  if (mimeType === "image/jpeg") return startsWith(0xff, 0xd8, 0xff);
  if (mimeType === "image/png") {
    return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  }
  if (mimeType === "image/gif") {
    const header = String.fromCharCode(...bytes.slice(0, 6));
    return header === "GIF87a" || header === "GIF89a";
  }
  if (mimeType === "image/webp") {
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  }
  return false;
}

export function validateImageDataUrl(value: unknown): ValidationResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: "imageDataUrl must be a base64 image data URL." };
  }

  const match = DATA_URL_PATTERN.exec(value);
  if (!match) {
    return {
      ok: false,
      error: "imageDataUrl must be a base64 JPEG, PNG, WebP, or GIF data URL.",
    };
  }

  const size = decodedBase64Length(match[2]);
  if (size < 1) {
    return { ok: false, error: "imageDataUrl contains invalid or empty base64 data." };
  }

  if (size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: `The decoded image exceeds the ${MAX_IMAGE_BYTES} byte limit.`,
    };
  }

  if (!hasExpectedImageSignature(match[1], match[2])) {
    return {
      ok: false,
      error: "imageDataUrl content does not match its declared image type.",
    };
  }

  return { ok: true, value };
}

export function validateAnalysisRequest(value: unknown): ValidationResult<AnalysisRequest> {
  if (!isRecord(value)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  if (!hasOnlyKeys(value, ["imageDataUrl", "mode", "query", "demo", "forceDemo"])) {
    return { ok: false, error: "Request body contains an unsupported field." };
  }

  if (!isOneOf(value.mode, ANALYSIS_MODES)) {
    return {
      ok: false,
      error: `mode must be one of: ${ANALYSIS_MODES.join(", ")}.`,
    };
  }

  if (
    value.query !== undefined &&
    (typeof value.query !== "string" || value.query.trim().length > MAX_QUERY_LENGTH)
  ) {
    return {
      ok: false,
      error: `query must be text no longer than ${MAX_QUERY_LENGTH} characters.`,
    };
  }

  if (value.demo !== undefined && typeof value.demo !== "boolean") {
    return { ok: false, error: "demo must be a boolean when supplied." };
  }
  if (value.forceDemo !== undefined && typeof value.forceDemo !== "boolean") {
    return { ok: false, error: "forceDemo must be a boolean when supplied." };
  }
  if (
    value.demo !== undefined &&
    value.forceDemo !== undefined &&
    value.demo !== value.forceDemo
  ) {
    return { ok: false, error: "demo and forceDemo must not conflict." };
  }

  const isDemo = value.demo === true || value.forceDemo === true;
  let image: ValidationResult<string> | undefined;
  if (value.imageDataUrl !== undefined) {
    image = validateImageDataUrl(value.imageDataUrl);
    if (!image.ok) return image;
  } else if (!isDemo) {
    return { ok: false, error: "imageDataUrl is required for live analysis." };
  }

  const query = typeof value.query === "string" ? value.query.trim() : undefined;
  return {
    ok: true,
    value: {
      ...(image?.ok ? { imageDataUrl: image.value } : {}),
      mode: value.mode,
      ...(query ? { query } : {}),
      ...(isDemo ? { demo: true } : {}),
    },
  };
}

function validateSafety(value: unknown): ValidationResult<SafetyAssessment> {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "level",
      "categories",
      "safeToAct",
      "requiresHumanConfirmation",
      "guidance",
    ]) ||
    !isOneOf(value.level, RISK_LEVELS) ||
    !Array.isArray(value.categories) ||
    value.categories.length === 0 ||
    value.categories.some((item) => !isOneOf(item, SAFETY_CATEGORIES)) ||
    typeof value.safeToAct !== "boolean" ||
    typeof value.requiresHumanConfirmation !== "boolean" ||
    typeof value.guidance !== "string" ||
    value.guidance.trim().length === 0 ||
    value.guidance.length > 600
  ) {
    return { ok: false, error: "safety is malformed." };
  }

  return {
    ok: true,
    value: {
      level: value.level as RiskLevel,
      categories: [...new Set(value.categories as SafetyCategory[])],
      safeToAct: value.safeToAct,
      requiresHumanConfirmation: value.requiresHumanConfirmation,
      guidance: value.guidance.trim(),
    },
  };
}

export function validateAnalysisResult(value: unknown): ValidationResult<AnalysisResult> {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "requestId",
      "mode",
      "summary",
      "details",
      "objects",
      "suggestedActions",
      "confidence",
      "safety",
      "source",
      "generatedAt",
    ]) ||
    typeof value.requestId !== "string" ||
    value.requestId.length < 1 ||
    value.requestId.length > 100 ||
    !isOneOf(value.mode, ANALYSIS_MODES) ||
    typeof value.summary !== "string" ||
    value.summary.trim().length === 0 ||
    value.summary.length > 1_000 ||
    typeof value.confidence !== "number" ||
    !Number.isFinite(value.confidence) ||
    value.confidence < 0 ||
    value.confidence > 1 ||
    (value.source !== "ai" && value.source !== "demo") ||
    typeof value.generatedAt !== "string" ||
    !Number.isFinite(Date.parse(value.generatedAt))
  ) {
    return { ok: false, error: "Analysis result is malformed." };
  }

  const details = validateStringArray(value.details, "details", 12, 600);
  if (!details.ok) return details;

  const actions = validateStringArray(value.suggestedActions, "suggestedActions", 8, 500);
  if (!actions.ok) return actions;

  let objects: AnalysisResult["objects"];
  if (value.objects !== undefined) {
    if (!Array.isArray(value.objects) || value.objects.length > 25) {
      return { ok: false, error: "objects is malformed." };
    }
    objects = [];
    for (const item of value.objects) {
      if (
        !isRecord(item) ||
        !hasOnlyKeys(item, ["label", "confidence", "boundingBox", "evidence"]) ||
        typeof item.label !== "string" ||
        item.label.trim().length === 0 ||
        item.label.length > 120 ||
        typeof item.confidence !== "number" ||
        !Number.isFinite(item.confidence) ||
        item.confidence < 0 ||
        item.confidence > 1 ||
        typeof item.evidence !== "string" ||
        item.evidence.trim().length === 0 ||
        item.evidence.length > 300 ||
        !isRecord(item.boundingBox) ||
        !hasOnlyKeys(item.boundingBox, ["xMin", "yMin", "xMax", "yMax"])
      ) {
        return { ok: false, error: "objects is malformed." };
      }
      const box = item.boundingBox;
      const coordinates = [box.xMin, box.yMin, box.xMax, box.yMax];
      if (
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
        return { ok: false, error: "objects is malformed." };
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
  }

  const safety = validateSafety(value.safety);
  if (!safety.ok) return safety;

  return {
    ok: true,
    value: {
      requestId: value.requestId,
      mode: value.mode,
      summary: value.summary.trim(),
      details: details.value,
      ...(objects ? { objects } : {}),
      suggestedActions: actions.value,
      confidence: value.confidence,
      safety: safety.value,
      source: value.source,
      generatedAt: value.generatedAt,
    },
  };
}

export function isAnalysisErrorResponse(value: unknown): value is AnalysisErrorResponse {
  if (!isRecord(value) || !isRecord(value.error)) return false;
  const error = value.error;
  return (
    isOneOf(error.code, ANALYSIS_ERROR_CODES) &&
    typeof error.message === "string" &&
    typeof error.retryable === "boolean" &&
    (error.requestId === undefined || typeof error.requestId === "string")
  );
}

export function makeErrorResponse(
  code: AnalysisErrorCode,
  message: string,
  retryable: boolean,
  requestId?: string,
): AnalysisErrorResponse {
  return { error: { code, message, retryable, ...(requestId ? { requestId } : {}) } };
}
