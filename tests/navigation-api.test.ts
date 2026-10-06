import assert from "node:assert/strict";
import test from "node:test";

import { handleNavigationRoute } from "@/lib/navigation-api";
import type { NavigationRouteResult } from "@/types/navigation";

const BODY = {
  origin: { latitude: 40.741, longitude: -73.989 },
  destination: { latitude: 40.748, longitude: -73.985 },
  profile: "pedestrian",
};

const ORS_RESPONSE = {
  features: [
    {
      geometry: {
        type: "LineString",
        coordinates: [
          [-73.989, 40.741],
          [-73.985, 40.748],
        ],
      },
      properties: {
        summary: { distance: 900, duration: 720 },
        segments: [
          {
            steps: [
              {
                distance: 900,
                duration: 720,
                type: 0,
                instruction: "Continue north.",
                way_points: [0, 1],
              },
            ],
          },
        ],
      },
    },
  ],
};

test("route API returns a guarded, non-autonomous pedestrian plan", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => Response.json(ORS_RESPONSE)) as typeof fetch;
  try {
    const response = await handleNavigationRoute(
      new Request("https://vision-aid.test/api/v1/navigation/route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "navigation-api-test-0001",
          "CF-Connecting-IP": "203.0.113.201",
        },
        body: JSON.stringify(BODY),
      }),
      {
        AUTH_REQUIRED: "false",
        OPENROUTESERVICE_BASE_URL: "https://ors.test/ors",
        OPENROUTESERVICE_API_KEY: "route-key",
      },
    );
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    const result = (await response.json()) as NavigationRouteResult;
    assert.equal(result.safeForAutonomousNavigation, false);
    assert.equal(result.requiresMobilityConfirmation, true);
    assert.equal(result.provider, "openrouteservice");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("route API fails closed when the routing provider is not configured", async () => {
  const response = await handleNavigationRoute(
    new Request("https://vision-aid.test/api/v1/navigation/route", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "navigation-api-test-0002",
        "CF-Connecting-IP": "203.0.113.202",
      },
      body: JSON.stringify(BODY),
    }),
    { AUTH_REQUIRED: "false" },
  );
  assert.equal(response.status, 503);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, "CONFIGURATION_ERROR");
});
