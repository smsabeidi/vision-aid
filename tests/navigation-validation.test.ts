import assert from "node:assert/strict";
import test from "node:test";

import { validateNavigationRouteRequest } from "@/lib/navigation-validation";

test("validates coordinates and defaults to pedestrian routing", () => {
  const result = validateNavigationRouteRequest({
    origin: { latitude: 40.741, longitude: -73.989 },
    destination: { latitude: 40.748, longitude: -73.985 },
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.profile, "pedestrian");
});

test("rejects invalid coordinates, identical points, and unsupported fields", () => {
  assert.equal(
    validateNavigationRouteRequest({
      origin: { latitude: 91, longitude: 0 },
      destination: { latitude: 40, longitude: -73 },
    }).ok,
    false,
  );
  assert.equal(
    validateNavigationRouteRequest({
      origin: { latitude: 40, longitude: -73 },
      destination: { latitude: 40, longitude: -73 },
    }).ok,
    false,
  );
  assert.equal(
    validateNavigationRouteRequest({
      origin: { latitude: 40, longitude: -73 },
      destination: { latitude: 41, longitude: -73 },
      unknown: true,
    }).ok,
    false,
  );
});
