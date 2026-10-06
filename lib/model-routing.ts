import { selectModelRoute, type ModelRoute } from "@/lib/production-config";
import { assessSafety } from "@/lib/safety";
import type { AnalysisRequest, SafetyAssessment } from "@/types/analysis";

export interface AnalysisRouteDecision {
  route: ModelRoute;
  preflightSafety: SafetyAssessment;
}

/** Deterministic routing keeps latency predictable and makes every route eval-able. */
export function routeAnalysisRequest(
  request: AnalysisRequest,
  environment: Record<string, string | undefined> = process.env,
): AnalysisRouteDecision {
  const preflightSafety = assessSafety({ mode: request.mode, query: request.query });
  return {
    route: selectModelRoute(request, preflightSafety.level, environment),
    preflightSafety,
  };
}
