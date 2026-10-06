import { booleanEnvironmentValue, isStrictProduction } from "@/lib/production-config";
import type { AnalysisMode, AnalysisErrorCode } from "@/types/analysis";

export interface AnalysisTelemetryEvent {
  event: "analysis.completed" | "analysis.failed" | "analysis.retried";
  requestId: string;
  mode: AnalysisMode;
  durationMs?: number;
  providerDurationMs?: number;
  attempt?: number;
  modelRole?: "perception" | "balanced" | "quality";
  model?: string;
  promptVersion?: string;
  status?: number;
  errorCode?: AnalysisErrorCode;
  providerRequestId?: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
}

/**
 * Emits allow-listed operational metadata only. Never pass images, user queries,
 * authorization headers, model output, or raw IP addresses to this function.
 */
export function emitAnalysisTelemetry(event: AnalysisTelemetryEvent): void {
  const enabled = booleanEnvironmentValue(
    "VISIONAID_TELEMETRY_ENABLED",
    isStrictProduction(),
  );
  if (!enabled) return;
  console.info(JSON.stringify({ timestamp: new Date().toISOString(), ...event }));
}
