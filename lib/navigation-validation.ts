import {
  NAVIGATION_ERROR_CODES,
  NAVIGATION_PROFILES,
  type GeoPoint,
  type NavigationErrorResponse,
  type NavigationRouteRequest,
  type NavigationRouteResult,
} from "@/types/navigation";

type Success<T> = { ok: true; value: T };
type Failure = { ok: false; error: string };
export type NavigationValidationResult<T> = Success<T> | Failure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function onlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function point(value: unknown, field: string): NavigationValidationResult<GeoPoint> {
  if (
    !isRecord(value) ||
    !onlyKeys(value, ["latitude", "longitude"]) ||
    typeof value.latitude !== "number" ||
    !Number.isFinite(value.latitude) ||
    value.latitude < -90 ||
    value.latitude > 90 ||
    typeof value.longitude !== "number" ||
    !Number.isFinite(value.longitude) ||
    value.longitude < -180 ||
    value.longitude > 180
  ) {
    return { ok: false, error: `${field} must contain valid latitude and longitude.` };
  }
  return {
    ok: true,
    value: { latitude: value.latitude, longitude: value.longitude },
  };
}

export function validateNavigationRouteRequest(
  value: unknown,
): NavigationValidationResult<NavigationRouteRequest> {
  if (
    !isRecord(value) ||
    !onlyKeys(value, ["origin", "destination", "profile", "language", "avoidSteps"])
  ) {
    return { ok: false, error: "Navigation request contains unsupported fields." };
  }
  const origin = point(value.origin, "origin");
  if (!origin.ok) return origin;
  const destination = point(value.destination, "destination");
  if (!destination.ok) return destination;
  const profile = value.profile ?? "pedestrian";
  if (
    typeof profile !== "string" ||
    !NAVIGATION_PROFILES.includes(profile as (typeof NAVIGATION_PROFILES)[number])
  ) {
    return { ok: false, error: "profile must be pedestrian or step_free." };
  }
  if (
    value.language !== undefined &&
    (typeof value.language !== "string" || !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(value.language))
  ) {
    return { ok: false, error: "language must be a supported locale code." };
  }
  if (value.avoidSteps !== undefined && typeof value.avoidSteps !== "boolean") {
    return { ok: false, error: "avoidSteps must be a boolean." };
  }
  if (
    origin.value.latitude === destination.value.latitude &&
    origin.value.longitude === destination.value.longitude
  ) {
    return { ok: false, error: "origin and destination must be different." };
  }
  return {
    ok: true,
    value: {
      origin: origin.value,
      destination: destination.value,
      profile: profile as NavigationRouteRequest["profile"],
      ...(value.language ? { language: value.language as string } : {}),
      ...(value.avoidSteps !== undefined ? { avoidSteps: value.avoidSteps } : {}),
    },
  };
}

export function isNavigationErrorResponse(value: unknown): value is NavigationErrorResponse {
  if (!isRecord(value) || !isRecord(value.error)) return false;
  return (
    NAVIGATION_ERROR_CODES.includes(value.error.code as never) &&
    typeof value.error.message === "string" &&
    typeof value.error.retryable === "boolean" &&
    typeof value.error.requestId === "string"
  );
}

export function validateNavigationRouteResult(
  value: unknown,
): NavigationValidationResult<NavigationRouteResult> {
  if (
    !isRecord(value) ||
    typeof value.requestId !== "string" ||
    typeof value.routeId !== "string" ||
    !NAVIGATION_PROFILES.includes(value.profile as never) ||
    typeof value.distanceMeters !== "number" ||
    !Number.isFinite(value.distanceMeters) ||
    value.distanceMeters <= 0 ||
    typeof value.durationSeconds !== "number" ||
    !Number.isFinite(value.durationSeconds) ||
    value.durationSeconds <= 0 ||
    value.provider !== "openrouteservice" ||
    value.mapData !== "OpenStreetMap" ||
    value.safeForAutonomousNavigation !== false ||
    value.requiresMobilityConfirmation !== true ||
    typeof value.generatedAt !== "string" ||
    !Number.isFinite(Date.parse(value.generatedAt)) ||
    !isRecord(value.geometry) ||
    value.geometry.type !== "LineString" ||
    !Array.isArray(value.geometry.coordinates) ||
    value.geometry.coordinates.length < 2 ||
    value.geometry.coordinates.length > 100_000 ||
    value.geometry.coordinates.some(
      (coordinate) =>
        !Array.isArray(coordinate) ||
        coordinate.length < 2 ||
        coordinate.length > 3 ||
        coordinate.some((item) => typeof item !== "number" || !Number.isFinite(item)),
    ) ||
    !Array.isArray(value.steps) ||
    value.steps.length > 5_000 ||
    !Array.isArray(value.warnings) ||
    value.warnings.length === 0 ||
    value.warnings.some((warning) => typeof warning !== "string" || !warning.trim())
  ) {
    return { ok: false, error: "Navigation route result is malformed." };
  }
  return { ok: true, value: value as unknown as NavigationRouteResult };
}
