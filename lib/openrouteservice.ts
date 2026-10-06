import { parseRetryAfter, withRetry } from "@/lib/resilience";
import {
  ResponseBodyTooLargeError,
  readBoundedResponseText,
} from "@/lib/bounded-response";
import type {
  NavigationErrorCode,
  NavigationRouteRequest,
  NavigationRouteResult,
  NavigationStep,
} from "@/types/navigation";

type Environment = Record<string, string | undefined>;

export class NavigationProviderError extends Error {
  readonly retryAfterMs?: number;

  constructor(
    readonly code: NavigationErrorCode,
    message: string,
    readonly status: number,
    readonly retryable: boolean,
    retryAfterMs?: number,
  ) {
    super(message);
    this.name = "NavigationProviderError";
    this.retryAfterMs = retryAfterMs;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function value(environment: Environment, name: string): string | undefined {
  return environment[name]?.trim() || undefined;
}

export function buildOpenRouteServiceRequest(request: NavigationRouteRequest): {
  profile: "foot-walking" | "wheelchair";
  body: Record<string, unknown>;
} {
  const stepFree = request.profile === "step_free";
  const avoidFeatures = stepFree
    ? ["ferries", "steps"]
    : ["ferries", "fords", ...(request.avoidSteps ? ["steps"] : [])];
  return {
    profile: stepFree ? "wheelchair" : "foot-walking",
    body: {
      coordinates: [
        [request.origin.longitude, request.origin.latitude],
        [request.destination.longitude, request.destination.latitude],
      ],
      preference: "recommended",
      instructions: true,
      instructions_format: "text",
      language: request.language ?? "en",
      units: "m",
      elevation: true,
      extra_info: ["steepness", "suitability", "surface", "waytype"],
      options: stepFree
        ? {
            avoid_features: avoidFeatures,
            profile_params: {
              restrictions: {
                surface_type: "cobblestone:flattened",
                track_type: "grade1",
                smoothness_type: "good",
                maximum_sloped_kerb: 0.06,
                maximum_incline: 6,
              },
            },
          }
        : {
            avoid_features: avoidFeatures,
            profile_params: {
              weightings: { quiet: { factor: 1 } },
            },
          },
    },
  };
}

function parseStep(value: unknown): NavigationStep | null {
  if (!isRecord(value) || typeof value.instruction !== "string") return null;
  const wayPoints = value.way_points;
  if (
    !Array.isArray(wayPoints) ||
    wayPoints.length !== 2 ||
    wayPoints.some((item) => typeof item !== "number" || !Number.isFinite(item))
  ) {
    return null;
  }
  const distance = Number(value.distance);
  const duration = Number(value.duration);
  const type = Number(value.type);
  if (![distance, duration, type].every(Number.isFinite)) return null;
  return {
    instruction: value.instruction.trim(),
    ...(typeof value.name === "string" && value.name.trim()
      ? { name: value.name.trim() }
      : {}),
    distanceMeters: distance,
    durationSeconds: duration,
    maneuverType: type,
    wayPoints: [wayPoints[0] as number, wayPoints[1] as number],
  };
}

export function parseOpenRouteServiceResponse(
  payload: unknown,
  request: NavigationRouteRequest,
  requestId: string,
  now = new Date(),
): NavigationRouteResult | null {
  if (!isRecord(payload) || !Array.isArray(payload.features) || payload.features.length === 0) {
    return null;
  }
  const feature = payload.features[0];
  if (!isRecord(feature) || !isRecord(feature.geometry) || !isRecord(feature.properties)) {
    return null;
  }
  const geometry = feature.geometry;
  const properties = feature.properties;
  if (
    geometry.type !== "LineString" ||
    !Array.isArray(geometry.coordinates) ||
    geometry.coordinates.length < 2 ||
    geometry.coordinates.length > 100_000 ||
    geometry.coordinates.some(
      (coordinate) =>
        !Array.isArray(coordinate) ||
        coordinate.length < 2 ||
        coordinate.length > 3 ||
        coordinate.some((item) => typeof item !== "number" || !Number.isFinite(item)),
    ) ||
    !isRecord(properties.summary)
  ) {
    return null;
  }
  const distance = Number(properties.summary.distance);
  const duration = Number(properties.summary.duration);
  if (!Number.isFinite(distance) || distance <= 0 || !Number.isFinite(duration) || duration <= 0) {
    return null;
  }
  const segments = Array.isArray(properties.segments) ? properties.segments : [];
  const steps: NavigationStep[] = [];
  for (const segment of segments) {
    if (!isRecord(segment) || !Array.isArray(segment.steps)) continue;
    for (const rawStep of segment.steps) {
      const step = parseStep(rawStep);
      if (!step) return null;
      steps.push(step);
    }
  }
  if (steps.length > 5_000) return null;
  const profile = request.profile ?? "pedestrian";
  return {
    requestId,
    routeId: `ors-${requestId}`,
    profile,
    distanceMeters: distance,
    durationSeconds: duration,
    geometry: {
      type: "LineString",
      coordinates: geometry.coordinates as number[][],
    },
    steps,
    warnings: [
      "Route and accessibility map data may be incomplete, stale, or wrong.",
      "Planning support only. Do not use this route to decide when to cross or to replace a cane, guide dog, orientation and mobility training, or human assistance.",
      ...(profile === "step_free"
        ? ["Step-free routing depends on available OpenStreetMap surface, kerb, incline, and width tags; unknown segments still require confirmation."]
        : []),
    ],
    provider: "openrouteservice",
    mapData: "OpenStreetMap",
    safeForAutonomousNavigation: false,
    requiresMobilityConfirmation: true,
    generatedAt: now.toISOString(),
  };
}

function mappedError(response: Response): NavigationProviderError {
  if (response.status === 404) {
    return new NavigationProviderError(
      "NO_ROUTE",
      "No pedestrian route was found for those points.",
      404,
      false,
    );
  }
  if (response.status === 429) {
    return new NavigationProviderError(
      "RATE_LIMITED",
      "The route service is busy. Please try again shortly.",
      429,
      true,
      parseRetryAfter(response.headers.get("retry-after")),
    );
  }
  if (response.status === 401 || response.status === 403) {
    return new NavigationProviderError(
      "CONFIGURATION_ERROR",
      "The route service is not configured correctly.",
      503,
      false,
    );
  }
  return new NavigationProviderError(
    "UPSTREAM_ERROR",
    "The route service could not calculate a route.",
    502,
    response.status === 408 || response.status >= 500,
  );
}

export async function planWithOpenRouteService(
  request: NavigationRouteRequest,
  requestId: string,
  signal: AbortSignal,
  options: {
    environment?: Environment;
    fetchImplementation?: typeof fetch;
  } = {},
): Promise<NavigationRouteResult> {
  const environment = options.environment ?? process.env;
  const baseUrl = value(environment, "OPENROUTESERVICE_BASE_URL");
  const apiKey = value(environment, "OPENROUTESERVICE_API_KEY");
  if (!baseUrl || !apiKey) {
    throw new NavigationProviderError(
      "CONFIGURATION_ERROR",
      "Pedestrian route planning is not configured.",
      503,
      false,
    );
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    throw new NavigationProviderError(
      "CONFIGURATION_ERROR",
      "Pedestrian route planning is not configured correctly.",
      503,
      false,
    );
  }
  if (
    environment.VISIONAID_RUNTIME_ENV?.trim() === "production" &&
    parsedUrl.protocol !== "https:"
  ) {
    throw new NavigationProviderError(
      "CONFIGURATION_ERROR",
      "Production route planning must use HTTPS.",
      503,
      false,
    );
  }
  const built = buildOpenRouteServiceRequest(request);
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/v2/directions/${built.profile}/geojson`;
  return withRetry(
    async () => {
      let response: Response;
      try {
        response = await (options.fetchImplementation ?? fetch)(endpoint, {
          method: "POST",
          headers: {
            Authorization: apiKey,
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
          body: JSON.stringify(built.body),
          signal,
        });
      } catch (error) {
        if (signal.aborted) throw error;
        throw new NavigationProviderError(
          "UPSTREAM_ERROR",
          "The route service could not be reached.",
          502,
          true,
        );
      }
      if (!response.ok) throw mappedError(response);
      let text: string;
      try {
        text = await readBoundedResponseText(response, 2 * 1024 * 1024);
      } catch (error) {
        if (error instanceof ResponseBodyTooLargeError) {
          throw new NavigationProviderError(
            "UPSTREAM_ERROR",
            "The route service returned an oversized response.",
            502,
            false,
          );
        }
        if (signal.aborted) throw error;
        throw new NavigationProviderError(
          "UPSTREAM_ERROR",
          "The route service response could not be read.",
          502,
          true,
        );
      }
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
      const result = parseOpenRouteServiceResponse(payload, request, requestId);
      if (!result) {
        throw new NavigationProviderError(
          "UPSTREAM_ERROR",
          "The route service returned an invalid route.",
          502,
          true,
        );
      }
      return result;
    },
    {
      maxAttempts: 2,
      baseDelayMs: 200,
      maxDelayMs: 800,
      signal,
      shouldRetry: (error) => error instanceof NavigationProviderError && error.retryable,
    },
  );
}
