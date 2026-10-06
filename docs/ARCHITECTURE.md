# VisionAid architecture

## System context

VisionAid is an Expo SDK 57 universal client behind a versioned server API. The client owns intentional capture, accessible interaction, speech, preferences, and optional local history. The server owns authentication, transport validation, traffic control, idempotency, model routing, provider resilience, output validation, safety enforcement, and privacy-minimized telemetry.

```text
User device                 VisionAid API edge                    Providers
-----------                 ------------------                    ---------
camera/gallery
      |
Expo client -- HTTPS --> POST /api/v1/analyze -- JWT/JWKS ------> identity
      |                    |                                      provider
      |                    +-- distributed rate/idempotency -----> Redis REST
      |                    |
      |                    +-- vision-provider router
      |                    +-- prompt v + strict schema
      |                    +-- retry + circuit breaker ----------> NVIDIA Cosmos 3
      |                    +-- parser + safety policy
      |<-- typed result ---+
      |
speech + optional local history

Expo client -- HTTPS --> POST /api/v1/navigation/route
                           |-- JWT scope + validation
                           |-- distributed rate/idempotency
                           +-- bounded request -------------------> openrouteservice
                           |                                      + OpenStreetMap
                           +-- validated planning-only route

Explicit guided demo stays on-device and makes no provider call.
```

## Trust boundaries

The mobile bundle is untrusted and contains no server credential. Production authorization uses a short-lived bearer JWT verified against issuer-controlled JWKS, audience, algorithms, and scope. Every request is validated independently of client behavior.

Images and queries are request data, not instructions. Image-embedded text and user text cannot change the system contract. Provider output is untrusted until it passes strict schema parsing and server safety enforcement.

## Public contract

`POST /api/v1/analyze` accepts the shared `AnalysisRequest` type and returns the existing `AnalysisResult` shape, including optional grounded objects with normalized boxes. The compatibility endpoint `/api/analyze` delegates to v1 and advertises deprecation. `POST /api/v1/navigation/route` accepts two coordinates plus a pedestrian or step-free profile and returns a validated planning-only route. `GET /api/v1/health` reports perception, authentication, distributed-state, and navigation readiness without secret material.

Transport controls include exact-origin CORS, JSON-only content, declared and streamed body limits, decoded image signature/size checks, correlation IDs, idempotency keys, no-store/security headers, typed error codes, and bounded retry hints.

## Model system

The primary provider is NVIDIA Cosmos 3 Nano Reasoner through a private NIM or vLLM OpenAI-compatible Chat Completions endpoint. Describe, Read, and Verify/find share one versioned schema containing the user answer, evidence, risk categories, and task-relevant objects with normalized 2D boxes. Mode-specific instructions and output budgets remain deterministic.

`VISION_PROVIDER=openai` activates the preserved OpenAI Responses API rollback path. The rollback router still selects its balanced or quality role from task and preflight risk. Both providers use strict schemas, bounded token/time budgets, no more than two attempts, and server-side validation and safety enforcement. The NVIDIA path also uses a circuit breaker. A provider change is a release event and must pass the locked evaluation suite.

No base-model training is planned for the MVP. Parameter-efficient adaptation or a specialist detector is considered only after representative evals demonstrate a persistent product gap.

## Route-planning system

The route provider maps `pedestrian` to openrouteservice `foot-walking` and `step_free` to its `wheelchair` profile. Avoid-step/surface/kerb/incline preferences are expressed when supported, but their correctness depends on OpenStreetMap coverage. Every response carries `safeForAutonomousNavigation: false` and `requiresMobilityConfirmation: true`.

This layer does not implement live location tracking, obstacle avoidance, crossing control, or a user-facing turn-by-turn experience. It is an authenticated route-planning foundation with strict validation, a ten-second server budget, one bounded retry, and a typed client.

Schema compliance is not factual correctness. The model result is parsed, risk-classified again with returned content/categories, and rewritten when critical action language is unsafe.

## State and privacy

The API stores no image or query. Distributed Redis state contains hashed request buckets, request fingerprints, processing state, and validated results for bounded idempotency replay. It does not contain raw identity, image, or query data.

Application telemetry is allow-listed operational metadata. Platform/provider logs and retention remain deployment responsibilities. Local history is optional and user-clearable; it is not claimed to be app-level encrypted.

## Failure behavior

- Missing production authentication, distributed state, or model credentials fails closed.
- Authentication/configuration failures are never retried.
- Transient network, 408, 429, and provider 5xx failures receive one bounded retry.
- Client retries reuse the same request and idempotency identifiers.
- Concurrent duplicate work receives a retryable conflict; completed work is replayed.
- A live request never silently becomes deterministic demo output.
- Explicit guided demo remains local and clearly labelled.

## Deployment and operations

The intended topology is EAS-hosted API routes on a Web-API-compatible edge runtime, an external OIDC/OAuth identity provider, Upstash-compatible Redis REST, a private authenticated NVIDIA Cosmos NIM/vLLM endpoint on GPU infrastructure, and hosted or self-managed openrouteservice. No API module relies on a filesystem or persistent process connection.

Production deployment sets secrets in the hosting secret manager, configures exact browser origins, enables strict runtime mode and telemetry, verifies `/api/v1/health`, and follows [Production](PRODUCTION.md). Model/prompt/schema/safety changes require the release process in [Evals](EVALS.md).

## Verification boundary

Typecheck, lint, 60 deterministic tests, dependency audit, and web export establish software contract health. They do not establish real-image quality, route correctness, accessibility conformance, load SLOs, privacy/legal compliance, or production uptime. Those remain explicit release gates in [Safety](SAFETY.md) and [Evals](EVALS.md).
