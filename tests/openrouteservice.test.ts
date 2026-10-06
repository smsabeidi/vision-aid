import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOpenRouteServiceRequest,
  parseOpenRouteServiceResponse,
  planWithOpenRouteService,
} from "@/lib/openrouteservice";
import type { NavigationRouteRequest } from "@/types/navigation";

const REQUEST: NavigationRouteRequest = {
  origin: { latitude: 40.741, longitude: -73.989 },
  destination: { latitude: 40.748, longitude: -73.985 },
  profile: "step_free",
  language: "en",
};

const ORS_RESPONSE = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [-73.989, 40.741, 8],
          [-73.985, 40.748, 11],
        ],
      },
      properties: {
        summary: { distance: 920.4, duration: 740.2 },
        segments: [
          {
            steps: [
              {
                distance: 920.4,
                duration: 740.2,
                type: 0,
                instruction: "Continue north.",
                name: "Broadway",
                way_points: [0, 1],
              },
            ],
          },
        ],
      },
    },
  ],
};

test("maps accessibility preferences onto the ORS wheelchair profile", () => {
  const built = buildOpenRouteServiceRequest(REQUEST);
  assert.equal(built.profile, "wheelchair");
  assert.deepEqual(built.body.coordinates, [
    [-73.989, 40.741],
    [-73.985, 40.748],
  ]);
  assert.match(JSON.stringify(built.body.options), /steps/);
  assert.match(JSON.stringify(built.body.options), /maximum_sloped_kerb/);
});

test("parses ORS GeoJSON without representing it as autonomous navigation", () => {
  const result = parseOpenRouteServiceResponse(
    ORS_RESPONSE,
    REQUEST,
    "req-route-parse",
    new Date("2026-07-18T12:00:00.000Z"),
  );
  assert.ok(result);
  assert.equal(result.distanceMeters, 920.4);
  assert.equal(result.steps[0]?.instruction, "Continue north.");
  assert.equal(result.safeForAutonomousNavigation, false);
  assert.equal(result.requiresMobilityConfirmation, true);
  assert.match(result.warnings.join(" "), /OpenStreetMap/);
});

test("calls the configured ORS GeoJSON endpoint with server-side authentication", async () => {
  let calledUrl = "";
  const result = await planWithOpenRouteService(
    REQUEST,
    "req-route-provider",
    new AbortController().signal,
    {
      environment: {
        OPENROUTESERVICE_BASE_URL: "https://ors.test/ors",
        OPENROUTESERVICE_API_KEY: "route-key",
      },
      fetchImplementation: async (input, init) => {
        calledUrl = String(input);
        assert.equal(new Headers(init?.headers).get("authorization"), "route-key");
        return Response.json(ORS_RESPONSE);
      },
    },
  );
  assert.equal(calledUrl, "https://ors.test/ors/v2/directions/wheelchair/geojson");
  assert.equal(result.provider, "openrouteservice");
});
