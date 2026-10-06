import type { AnalysisMode, AnalysisRequest, RiskLevel } from "@/types/analysis";

export const API_VERSION = "v1";
export const PROMPT_VERSION = "vision-aid-2026-07-17.1";

export type ModelRole = "balanced" | "quality";
export type ImageDetail = "low" | "high" | "original";
export type ReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh";

export interface ModelRoute {
  role: ModelRole;
  model: string;
  fallbackModel?: string;
  imageDetail: ImageDetail;
  reasoningEffort: ReasoningEffort;
  maxOutputTokens: number;
  timeoutMs: number;
}

type Environment = Record<string, string | undefined>;

const MODEL_DEFAULTS: Record<AnalysisMode, Omit<ModelRoute, "model" | "fallbackModel">> = {
  describe: {
    role: "balanced",
    imageDetail: "high",
    reasoningEffort: "none",
    maxOutputTokens: 900,
    timeoutMs: 20_000,
  },
  read: {
    role: "quality",
    imageDetail: "original",
    reasoningEffort: "low",
    maxOutputTokens: 1_600,
    timeoutMs: 28_000,
  },
  find: {
    role: "quality",
    imageDetail: "high",
    reasoningEffort: "low",
    maxOutputTokens: 1_000,
    timeoutMs: 24_000,
  },
};

function envValue(environment: Environment, name: string): string | undefined {
  return environment[name]?.trim() || undefined;
}

function positiveInteger(
  environment: Environment,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = envValue(environment, name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

function isReasoningEffort(value: string | undefined): value is ReasoningEffort {
  return ["none", "low", "medium", "high", "xhigh"].includes(value ?? "");
}

function isImageDetail(value: string | undefined): value is ImageDetail {
  return ["low", "high", "original"].includes(value ?? "");
}

export function isStrictProduction(environment: Environment = process.env): boolean {
  return envValue(environment, "VISIONAID_RUNTIME_ENV") === "production";
}

export function booleanEnvironmentValue(
  name: string,
  fallback: boolean,
  environment: Environment = process.env,
): boolean {
  const raw = envValue(environment, name)?.toLowerCase();
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return fallback;
}

export function selectModelRoute(
  request: AnalysisRequest,
  riskLevel: RiskLevel,
  environment: Environment = process.env,
): ModelRoute {
  const defaults = MODEL_DEFAULTS[request.mode];
  const forceQuality = riskLevel === "high" || riskLevel === "critical";
  const role: ModelRole = forceQuality ? "quality" : defaults.role;
  const modeName = request.mode.toUpperCase();
  const roleModel =
    role === "quality"
      ? envValue(environment, "OPENAI_MODEL_QUALITY") || "gpt-5.6-sol"
      : envValue(environment, "OPENAI_MODEL_BALANCED") || "gpt-5.6-terra";
  const model =
    envValue(environment, `OPENAI_MODEL_${modeName}`) ||
    envValue(environment, "OPENAI_MODEL") ||
    roleModel;
  const fallbackModel =
    role === "balanced"
      ? envValue(environment, "OPENAI_MODEL_FALLBACK") ||
        envValue(environment, "OPENAI_MODEL_QUALITY") ||
        "gpt-5.6-sol"
      : undefined;
  const configuredDetail = envValue(environment, `OPENAI_IMAGE_DETAIL_${modeName}`);
  const configuredEffort = envValue(environment, `OPENAI_REASONING_EFFORT_${modeName}`);

  return {
    ...defaults,
    role,
    model,
    ...(fallbackModel && fallbackModel !== model ? { fallbackModel } : {}),
    imageDetail: isImageDetail(configuredDetail)
      ? configuredDetail
      : defaults.imageDetail,
    reasoningEffort: isReasoningEffort(configuredEffort)
      ? configuredEffort
      : defaults.reasoningEffort,
    maxOutputTokens: positiveInteger(
      environment,
      `OPENAI_MAX_OUTPUT_TOKENS_${modeName}`,
      defaults.maxOutputTokens,
      256,
      4_000,
    ),
    timeoutMs: positiveInteger(
      environment,
      `OPENAI_TIMEOUT_MS_${modeName}`,
      defaults.timeoutMs,
      5_000,
      29_000,
    ),
  };
}

export interface ReadinessCheck {
  name: "visionProvider" | "authentication" | "distributedState" | "navigation";
  ready: boolean;
  required: boolean;
}

export function productionReadiness(
  environment: Environment = process.env,
): ReadinessCheck[] {
  const strict = isStrictProduction(environment);
  const authRequired = strict || booleanEnvironmentValue("AUTH_REQUIRED", false, environment);
  const visionProvider = (envValue(environment, "VISION_PROVIDER") || "nvidia").toLowerCase();
  const isSecureUrl = (raw: string | undefined): boolean => {
    if (!raw) return false;
    try {
      return new URL(raw).protocol === "https:";
    } catch {
      return false;
    }
  };
  return [
    {
      name: "visionProvider",
      ready:
        visionProvider === "openai"
          ? Boolean(envValue(environment, "OPENAI_API_KEY"))
          : visionProvider === "nvidia" && Boolean(
              isSecureUrl(envValue(environment, "NVIDIA_COSMOS_BASE_URL")) &&
                envValue(environment, "NVIDIA_COSMOS_API_KEY"),
            ),
      required: strict,
    },
    {
      name: "authentication",
      ready:
        !authRequired ||
        Boolean(
          isSecureUrl(envValue(environment, "AUTH_JWKS_URL")) &&
            envValue(environment, "AUTH_ISSUER") &&
            envValue(environment, "AUTH_AUDIENCE"),
        ),
      required: authRequired,
    },
    {
      name: "distributedState",
      ready: Boolean(
        isSecureUrl(envValue(environment, "UPSTASH_REDIS_REST_URL")) &&
          envValue(environment, "UPSTASH_REDIS_REST_TOKEN"),
      ),
      required: strict,
    },
    {
      name: "navigation",
      ready: Boolean(
        isSecureUrl(envValue(environment, "OPENROUTESERVICE_BASE_URL")) &&
          envValue(environment, "OPENROUTESERVICE_API_KEY"),
      ),
      required: strict,
    },
  ];
}
