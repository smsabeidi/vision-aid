# VisionAid production model and API runbook

## Release posture

The product ideal is treated as validated by the company and the codebase is now in funded production hardening. That does not waive model-safety, accessibility, privacy, security, or reliability gates. Strict production mode fails closed when credentials, JWT verification, or distributed request state are missing.

Set `VISIONAID_RUNTIME_ENV=production` only in an environment that passes `GET /api/v1/health` with HTTP 200.

## Current usage inventory

| Path | Input | Provider | Contract |
| --- | --- | --- | --- |
| Describe | One intentional image plus optional question | NVIDIA Cosmos 3 Nano Reasoner | Strict `vision_aid_analysis` schema plus grounded objects |
| Read | One intentional image plus optional question | NVIDIA Cosmos 3 Nano Reasoner | Same schema, OCR-focused instruction |
| Verify (`find`) | One intentional image plus a narrow question | NVIDIA Cosmos 3 Nano Reasoner | Same schema, evidence-focused instruction |
| Route plan | Origin, destination, pedestrian/step-free preferences | openrouteservice + OpenStreetMap | Typed GeoJSON route with mandatory non-autonomous safety flags |
| Guided demo | Packaged deterministic fixture | No provider call | Same `AnalysisResult` domain contract |

Live images are accepted as validated Base64 data URLs up to 5 MiB. The API does not place images or queries in application telemetry and returns no raw provider body. The rollback OpenAI request sets `store: false`; the NVIDIA gateway, serving stack, proxy, and platform must be configured and audited separately for retention.

## Target model mapping

The primary perception deployment is:

| Workload | Default | Serving contract | Fallback |
| --- | --- | --- | --- |
| Describe | `nvidia/cosmos3-nano-reasoner` | Private NIM/vLLM Chat Completions endpoint; strict JSON schema | Same pinned deployment, one bounded transient retry |
| Read/OCR | `nvidia/cosmos3-nano-reasoner` | Same model; larger output budget and text-region grounding | Same pinned deployment, one bounded transient retry |
| Verify/find | `nvidia/cosmos3-nano-reasoner` | Same model; evidence/object grounding | Same pinned deployment, one bounded transient retry |

`VISION_PROVIDER=openai` activates the prior task/risk-routed OpenAI implementation as a rollback path. Model, prompt, schema, endpoint, timeout, or provider changes are release configuration and must run the locked regression and safety suites before promotion. Pin the NVIDIA model and container digest in production; do not rely on a moving alias alone.

Official references: [NVIDIA Cosmos repository](https://github.com/nvidia/cosmos), [Cosmos3-Nano model card](https://huggingface.co/nvidia/Cosmos3-Nano), [Cosmos Reasoner NIM API](https://docs.nvidia.com/nim/vision-language-models/1.7.0/examples/cosmos-reason3/api.html), and [openrouteservice routing options](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/routing-options). The full decision and training boundary are in [NVIDIA Vision and Navigation](NVIDIA-VISION-NAVIGATION.md).

## API contract

Primary endpoint: `POST /api/v1/analyze`

Compatibility endpoint: `POST /api/analyze`, which returns `Deprecation: true` and a successor `Link` header.

Route-planning endpoint: `POST /api/v1/navigation/route`, authorized with the `navigation:route` scope by default.

Required production headers:

- `Authorization: Bearer <short-lived JWT>` verified against configured JWKS, issuer, audience, algorithms, and optional scope.
- `Idempotency-Key`: 16–128 safe ASCII characters, stable across retries of one operation.
- `X-Request-Id`: 8–100 safe ASCII characters for end-to-end correlation.
- `Content-Type: application/json`.

The client generates stable operation IDs, retries transient POST failures at most once, observes `Retry-After`, and uses one total timeout/cancellation signal. Live failures never silently become demo output; fallback requires explicit opt-in.

Responses include `X-API-Version`, `X-Request-Id`, `RateLimit-*`, `Server-Timing`, cache-prevention and security headers, a model role (not credentials), provider-attempt count, and idempotency commit/replay state where applicable.

## Authentication and authorization

Configure:

```dotenv
AUTH_REQUIRED=true
AUTH_JWKS_URL=https://issuer.example/.well-known/jwks.json
AUTH_ISSUER=https://issuer.example/
AUTH_AUDIENCE=visionaid-api
AUTH_REQUIRED_SCOPE=analysis:write
AUTH_NAVIGATION_SCOPE=navigation:route
AUTH_ALLOWED_ALGORITHMS=RS256,ES256
```

Use short-lived user access tokens from the selected identity provider. Do not place a shared API secret or a long-lived token in the mobile binary or an `EXPO_PUBLIC_*` variable. The client accepts an access-token callback so refresh remains owned by the authentication layer.

## Distributed traffic controls and idempotency

Strict production requires an Upstash-compatible Redis REST endpoint. The server uses an atomic Lua `INCR`/`PEXPIRE` operation for 20 requests per principal per minute and SHA-256 hashes the principal bucket before storage. Anonymous development traffic falls back to a bounded isolate-local limiter only outside strict production.

The same distributed store claims idempotency keys atomically, records only a request fingerprint while work is in progress, and caches the validated result for 24 hours. It never stores the submitted image or raw query. A completed route result, including coordinates and instructions, is cached for idempotent replay for that same period; the production privacy notice and retention inventory must disclose this. Reuse with different data is rejected; concurrent duplicates receive a retryable 409.

## Resilience and observability

- NVIDIA perception has a bounded 25-second default upstream budget; route planning has a ten-second server budget. The OpenAI rollback retains its per-mode budgets.
- At most two provider attempts with bounded jitter and `Retry-After` support.
- Circuit opens after five failed logical provider operations and allows one probe after 30 seconds.
- Configuration/authentication failures are not retried.
- Strict structured output is parsed again into the domain contract, then safety policy is applied.
- Telemetry is an allow-list of request ID, mode, duration, model role/name, prompt version, status, provider request ID, attempts, and token counts. Images, queries, output text, IPs, and credentials are prohibited.
- `GET /api/v1/health` reveals readiness booleans and version identifiers, never secret values.

Route provider and platform logs through a sink with documented redaction, regional controls, access policy, retention, and deletion. Application logging alone is not an incident program.

## Prompt changes

Base prompt version: `vision-aid-2026-07-17.1`; the NVIDIA adapter records its Cosmos-specific suffix separately.

The prompt keeps only the user-visible outcome, evidence/grounding/safety constraints, stopping condition, and schema. It explicitly treats image text and the user query as untrusted data, prohibits identity/high-consequence verdicts, and keeps mode/query data after the stable instruction prefix.

## Compatibility assessment

- Existing `AnalysisResult` consumers remain compatible; live results may now include an optional `objects` array with normalized boxes.
- The old endpoint remains available with deprecation headers.
- `VISION_PROVIDER` selects NVIDIA by default; OpenAI and its model overrides remain a rollback option.
- Explicit local demo mode is unchanged.
- Live requests without the selected provider endpoint/credential return a typed configuration error instead of fabricated sample output.
- Client demo fallback now defaults off; callers must opt in explicitly.
- Production mode additionally requires JWT configuration, distributed state, routing configuration, and an idempotency key.

## Validation performed

The repository release gate is:

```bash
npm run verify
npx expo-doctor
```

Automated coverage includes validation, request contracts, safety policy, NVIDIA and OpenAI model parsing, grounded-object schema, provider fallback selection, pedestrian/step-free request mapping, guarded route responses, retries, circuit state, idempotency, authentication posture, rate limiting, and production readiness. Run representative image/object and launch-geography route regressions, adversarial safety, physical-device accessibility, load, and failure-injection suites before a real pilot.

## Unchanged

- No fine-tuning or proprietary model was introduced.
- No captured image, query, or server analysis history database was added.
- Confidence remains model-estimated and is not represented as a calibrated probability.
- High-consequence action decisions remain outside product scope.
- The deterministic guided fixture remains presentation evidence only.

## Current blockers before funded production traffic

- No live NVIDIA Cosmos or openrouteservice call was exercised in this repository environment because no credentials/endpoints were supplied.
- The production NVIDIA GPU endpoint, identity provider/JWKS, Redis REST, and route-provider resources are not provisioned in the repository.
- A representative, consented real-image regression set and locked scorecard are not present.
- Load-test SLOs, external security review, privacy/legal review, and physical VoiceOver/TalkBack sign-off remain external release gates.
- Dependency audit currently has no high/critical production advisory; moderate findings are transitive Expo build-chain advisories and require upstream-compatible remediation rather than a forced breaking downgrade.

These are stop-ship items for public production, not reasons to weaken the implementation contract.
