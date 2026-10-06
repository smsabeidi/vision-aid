import assert from "node:assert/strict";
import test from "node:test";

import { ApiAuthError, authenticateAnalysisRequest } from "@/lib/api-auth";

test("allows an anonymous development boundary when auth is explicitly optional", async () => {
  const principal = await authenticateAnalysisRequest(
    new Request("https://vision-aid.test/api/v1/analyze"),
    { AUTH_REQUIRED: "false" },
  );
  assert.equal(principal.anonymous, true);
  assert.equal(principal.subject, "anonymous");
});

test("fails closed when production authentication is missing", async () => {
  await assert.rejects(
    authenticateAnalysisRequest(
      new Request("https://vision-aid.test/api/v1/analyze"),
      { VISIONAID_RUNTIME_ENV: "production" },
    ),
    (error: unknown) =>
      error instanceof ApiAuthError &&
      error.code === "AUTHENTICATION_REQUIRED" &&
      error.status === 401,
  );
});

test("rejects a malformed bearer header even when anonymous development is allowed", async () => {
  await assert.rejects(
    authenticateAnalysisRequest(
      new Request("https://vision-aid.test/api/v1/analyze", {
        headers: { Authorization: "Basic not-a-bearer-token" },
      }),
      { AUTH_REQUIRED: "false" },
    ),
    (error: unknown) =>
      error instanceof ApiAuthError && error.code === "AUTHENTICATION_REQUIRED",
  );
});
