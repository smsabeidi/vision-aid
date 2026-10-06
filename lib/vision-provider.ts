import type { AnalysisErrorCode, AnalysisRequest, AnalysisResult } from "@/types/analysis";

export type VisionProviderName = "nvidia" | "openai";
export type VisionModelRole = "perception" | "balanced" | "quality";

export class VisionProviderError extends Error {
  readonly retryAfterMs?: number;

  constructor(
    readonly code: AnalysisErrorCode,
    message: string,
    readonly status: number,
    readonly retryable: boolean,
    options: { retryAfterMs?: number; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "VisionProviderError";
    this.retryAfterMs = options.retryAfterMs;
  }
}

export interface VisionAnalysisOutcome {
  result: AnalysisResult;
  provider: VisionProviderName;
  modelRole: VisionModelRole;
  model: string;
  attempts: number;
  providerRequestId?: string;
}

export interface VisionAnalysisOptions {
  environment?: Record<string, string | undefined>;
  fetchImplementation?: typeof fetch;
}

export type VisionAnalysisFunction = (
  request: AnalysisRequest,
  requestId: string,
  signal: AbortSignal,
  options?: VisionAnalysisOptions,
) => Promise<VisionAnalysisOutcome>;
