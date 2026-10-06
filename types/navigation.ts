export const NAVIGATION_PROFILES = ["pedestrian", "step_free"] as const;
export type NavigationProfile = (typeof NAVIGATION_PROFILES)[number];

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface NavigationRouteRequest {
  origin: GeoPoint;
  destination: GeoPoint;
  profile?: NavigationProfile;
  language?: string;
  avoidSteps?: boolean;
}

export interface NavigationStep {
  instruction: string;
  name?: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuverType: number;
  wayPoints: [number, number];
}

export interface NavigationRouteResult {
  requestId: string;
  routeId: string;
  profile: NavigationProfile;
  distanceMeters: number;
  durationSeconds: number;
  /** GeoJSON LineString coordinates in [longitude, latitude, optional elevation] order. */
  geometry: { type: "LineString"; coordinates: number[][] };
  steps: NavigationStep[];
  warnings: string[];
  provider: "openrouteservice";
  mapData: "OpenStreetMap";
  safeForAutonomousNavigation: false;
  requiresMobilityConfirmation: true;
  generatedAt: string;
}

export const NAVIGATION_ERROR_CODES = [
  "VALIDATION_ERROR",
  "AUTHENTICATION_REQUIRED",
  "FORBIDDEN",
  "RATE_LIMITED",
  "IDEMPOTENCY_CONFLICT",
  "CONFIGURATION_ERROR",
  "NO_ROUTE",
  "NETWORK_ERROR",
  "UPSTREAM_ERROR",
  "SERVICE_UNAVAILABLE",
  "TIMEOUT",
  "CANCELLED",
] as const;

export type NavigationErrorCode = (typeof NAVIGATION_ERROR_CODES)[number];

export interface NavigationErrorResponse {
  error: {
    code: NavigationErrorCode;
    message: string;
    retryable: boolean;
    requestId: string;
  };
}

export interface NavigationClientOptions {
  baseUrl?: string;
  accessToken?: string;
  getAccessToken?: () => Promise<string | undefined>;
  timeoutMs?: number;
  maxAttempts?: number;
  signal?: AbortSignal;
  requestId?: string;
  idempotencyKey?: string;
}
