import assert from "node:assert/strict";
import test from "node:test";

import {
  getNavigationEndpoint,
  planNavigationRoute,
} from "@/lib/navigation-client";

const REQUEST = {
  origin: { latitude: 40.741, longitude: -73.989 },
  destination: { latitude: 40.748, longitude: -73.985 },
  profile: "pedestrian" as const,
};

const RESULT = {
  requestId: "navreq-client-retry",
  routeId: "ors-navreq-client-retry",
  profile: "pedestrian",
  distanceMeters: 900,
  durationSeconds: 720,
  geometry: {
    type: "LineString",
    coordinates: [
      [-73.989, 40.741],
      [-73.985, 40.748],
    ],
  },
  steps: [],
  warnings: ["Planning support only."],
  provider: "openrouteservice",
  mapData: "OpenStreetMap",
  safeForAutonomousNavigation: false,
  requiresMobilityConfirmation: true,
  generatedAt: "2026-07-18T12:00:00.000Z",
};

test("builds same-origin and configured navigation endpoints", () => {
  assert.equal(getNavigationEndpoint(""), "/api/v1/navigation/route");
  assert.equal(
    getNavigationEndpoint("https://api.visionaid.example/"),
    "https://api.visionaid.example/api/v1/navigation/route",
  );
});

test("retries a transient route response with stable operation identifiers", async () => {
  const originalFetch = globalThis.fetch;
  const keys: string[] = [];
  const requestIds: string[] = [];
  let calls = 0;
  globalThis.fetch = (async (_input, init) => {
    calls += 1;
    const headers = new Headers(init?.headers);
    keys.push(headers.get("idempotency-key") ?? "");
    requestIds.push(headers.get("x-request-id") ?? "");
    if (calls === 1) {
      return Response.json(
        {
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "busy",
            retryable: true,
            requestId: "navreq-client-retry",
          },
        },
        { status: 503 },
      );
    }
    return Response.json(RESULT);
  }) as typeof fetch;
  try {
    const result = await planNavigationRoute(REQUEST, {
      requestId: "navreq-client-retry",
      idempotencyKey: "navidem-client-retry-0001",
    });
    assert.equal(result.safeForAutonomousNavigation, false);
    assert.equal(calls, 2);
    assert.equal(keys[0], keys[1]);
    assert.equal(requestIds[0], requestIds[1]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
