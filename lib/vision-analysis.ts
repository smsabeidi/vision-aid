import { analyzeWithNvidia } from "@/lib/nvidia-analysis";
import { analyzeWithOpenAI, OpenAIAnalysisError } from "@/lib/openai-analysis";
import {
  VisionProviderError,
  type VisionAnalysisOptions,
  type VisionAnalysisOutcome,
  type VisionProviderName,
} from "@/lib/vision-provider";
import type { AnalysisRequest } from "@/types/analysis";

function configuredProvider(
  environment: Record<string, string | undefined>,
): VisionProviderName {
  const provider = environment.VISION_PROVIDER?.trim().toLowerCase() || "nvidia";
  if (provider !== "nvidia" && provider !== "openai") {
    throw new VisionProviderError(
      "CONFIGURATION_ERROR",
      "The configured vision provider is not supported.",
      503,
      false,
    );
  }
  return provider;
}

export async function analyzeWithVisionProvider(
  request: AnalysisRequest,
  requestId: string,
  signal: AbortSignal,
  options: VisionAnalysisOptions = {},
): Promise<VisionAnalysisOutcome> {
  const environment = options.environment ?? process.env;
  if (configuredProvider(environment) === "nvidia") {
    return analyzeWithNvidia(request, requestId, signal, options);
  }
  try {
    const outcome = await analyzeWithOpenAI(request, requestId, signal, options);
    return { ...outcome, provider: "openai" };
  } catch (error) {
    if (error instanceof OpenAIAnalysisError) {
      throw new VisionProviderError(
        error.code,
        error.message,
        error.status,
        error.retryable,
        { retryAfterMs: error.retryAfterMs, cause: error },
      );
    }
    throw error;
  }
}
