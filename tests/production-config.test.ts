import assert from "node:assert/strict";
import test from "node:test";

import { isStrictProduction, productionReadiness } from "@/lib/production-config";

test("requires model, JWT, and distributed state for strict production", () => {
  const environment = { VISIONAID_RUNTIME_ENV: "production" };
  assert.equal(isStrictProduction(environment), true);
  const checks = productionReadiness(environment);
  assert.equal(checks.every((check) => check.required && !check.ready), true);
});

test("reports a fully configured production boundary without exposing secrets", () => {
  const checks = productionReadiness({
    VISIONAID_RUNTIME_ENV: "production",
    VISION_PROVIDER: "nvidia",
    NVIDIA_COSMOS_BASE_URL: "https://cosmos.test/v1",
    NVIDIA_COSMOS_API_KEY: "secret",
    OPENROUTESERVICE_BASE_URL: "https://api.openrouteservice.org",
    OPENROUTESERVICE_API_KEY: "secret",
    AUTH_JWKS_URL: "https://issuer.test/jwks",
    AUTH_ISSUER: "https://issuer.test/",
    AUTH_AUDIENCE: "visionaid-api",
    UPSTASH_REDIS_REST_URL: "https://redis.test",
    UPSTASH_REDIS_REST_TOKEN: "secret",
  });
  assert.equal(checks.every((check) => check.ready), true);
  assert.equal(JSON.stringify(checks).includes("secret"), false);
});

test("rejects an unsupported vision provider even when NVIDIA secrets exist", () => {
  const [vision] = productionReadiness({
    VISIONAID_RUNTIME_ENV: "production",
    VISION_PROVIDER: "typo-provider",
    NVIDIA_COSMOS_BASE_URL: "https://cosmos.test/v1",
    NVIDIA_COSMOS_API_KEY: "secret",
  });
  assert.equal(vision.name, "visionProvider");
  assert.equal(vision.ready, false);
});
