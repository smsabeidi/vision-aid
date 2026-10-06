export const ANALYSIS_MODES = ["describe", "read", "find"] as const;

export type AnalysisMode = (typeof ANALYSIS_MODES)[number];

export const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;

export type RiskLevel = (typeof RISK_LEVELS)[number];

export const SAFETY_CATEGORIES = [
  "none",
  "navigation",
  "medical",
  "medication",
  "financial",
  "legal",
  "emergency",
  "identity",
] as const;

export type SafetyCategory = (typeof SAFETY_CATEGORIES)[number];

export interface AnalysisRequest {
  /** A base64 data URL. Raw images and remote URLs are intentionally unsupported. */
  imageDataUrl?: string;
  mode: AnalysisMode;
  query?: string;
  /** Forces the deterministic, clearly labelled investor-demo path without requiring a camera image. */
  demo?: boolean;
  /** Compatibility alias for demo. Supplying conflicting flags is rejected. */
  forceDemo?: boolean;
}

export interface SafetyAssessment {
  level: RiskLevel;
  categories: SafetyCategory[];
  safeToAct: boolean;
  requiresHumanConfirmation: boolean;
  guidance: string;
}

export interface NormalizedBoundingBox {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

export interface DetectedObject {
  label: string;
  /** Model-estimated confidence, not a calibrated detection probability. */
  confidence: number;
  /** Coordinates normalized to the inclusive 0–1 image range. */
  boundingBox: NormalizedBoundingBox;
  evidence: string;
}

export interface AnalysisResult {
  requestId: string;
  mode: AnalysisMode;
  summary: string;
  details: string[];
  /** Grounded objects when the configured vision provider returns localization. */
  objects?: DetectedObject[];
  suggestedActions: string[];
  /** Model-estimated confidence in the inclusive range 0–1, not a calibrated probability. */
  confidence: number;
  safety: SafetyAssessment;
  source: "ai" | "demo";
  generatedAt: string;
}

export const ANALYSIS_ERROR_CODES = [
  "VALIDATION_ERROR",
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "CONFIGURATION_ERROR",
  "AUTHENTICATION_REQUIRED",
  "FORBIDDEN",
  "IDEMPOTENCY_CONFLICT",
  "SERVICE_UNAVAILABLE",
  "RATE_LIMITED",
  "UPSTREAM_ERROR",
  "INVALID_MODEL_RESPONSE",
  "NETWORK_ERROR",
  "TIMEOUT",
  "CANCELLED",
] as const;

export type AnalysisErrorCode = (typeof ANALYSIS_ERROR_CODES)[number];

export interface AnalysisErrorBody {
  code: AnalysisErrorCode;
  message: string;
  retryable: boolean;
  requestId?: string;
}

export interface AnalysisErrorResponse {
  error: AnalysisErrorBody;
}

export interface AnalysisClientOptions {
  timeoutMs?: number;
  /** Explicit opt-in only. Live failures never silently become sample output. */
  fallbackToDemo?: boolean;
  /** Origin or full endpoint. Defaults to EXPO_PUBLIC_API_URL, then same-origin v1. */
  baseUrl?: string;
  signal?: AbortSignal;
  /** Short-lived user access token supplied by the app's authentication layer. */
  accessToken?: string;
  /** Preferred for refreshable credentials; called immediately before the request. */
  getAccessToken?: () => Promise<string | undefined>;
  /** Stable across retries of one logical operation. Generated when omitted. */
  idempotencyKey?: string;
  /** Correlation ID returned by the API. Generated when omitted. */
  requestId?: string;
  /** Total attempts for transient failures, including the first. Defaults to 2. */
  maxAttempts?: number;
}
