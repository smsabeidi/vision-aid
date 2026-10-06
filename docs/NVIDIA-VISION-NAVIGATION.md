# NVIDIA perception and route-planning decision

## Decision

As verified on 2026-07-18, VisionAid's primary perception model is the **NVIDIA Cosmos 3 Nano Reasoner** surface, served as `nvidia/cosmos3-nano-reasoner` through a private NVIDIA NIM or vLLM OpenAI-compatible endpoint. The repository defaults `VISION_PROVIDER` to `nvidia`; the existing OpenAI implementation remains a controlled rollback path.

Cosmos 3 is NVIDIA's newest open Cosmos generation and supports image/video understanding plus 2D visual grounding. The selected Nano Reasoner serving surface is the 8B reasoning component; NVIDIA's combined `Cosmos3-Nano` checkpoint is a larger 16B package. The weights are distributed under NVIDIA's Open Model Development and Work License 1.1, so legal must review the actual deployment and redistribution plan rather than assume an OSI license.

Official sources:

- [NVIDIA Cosmos repository and deployment instructions](https://github.com/nvidia/cosmos)
- [NVIDIA Cosmos3-Nano model card and license](https://huggingface.co/nvidia/Cosmos3-Nano)
- [Cosmos Reasoner NIM Chat Completions API](https://docs.nvidia.com/nim/vision-language-models/1.7.0/examples/cosmos-reason3/api.html)
- [NVIDIA NIM structured generation](https://docs.nvidia.com/nim/vision-language-models/1.1.0/structured-generation.html)

## What is implemented

`POST /api/v1/analyze` now routes live perception to NVIDIA by default. The adapter:

- sends one intentional image to a private HTTPS Chat Completions-compatible endpoint;
- requests strict JSON-schema output;
- returns task-relevant objects with confidence, evidence, and normalized 0–1 bounding boxes;
- validates every field and coordinate server-side;
- treats user text and text inside the image as untrusted data;
- applies the existing post-model safety policy;
- uses one bounded retry, a hard timeout, circuit breaking, request correlation, and privacy-minimized telemetry;
- fails closed when production endpoint authentication is absent.

The response's object list is semantic grounding, not a guarantee of complete obstacle detection. Cosmos must not be used as the sole sensor for continuous mobility, collision avoidance, or street crossing.

## Why we are not training a base model

A usable open-weight base model exists, so training from scratch would add cost, delay, data risk, and validation burden without evidence that it improves the MVP. The production sequence is:

1. Lock a consented, representative evaluation set for Describe, Read, Verify, object labels, and bounding boxes.
2. Benchmark the pinned Cosmos checkpoint and serving stack against release thresholds.
3. Improve capture, prompts, schemas, and deterministic post-processing where those changes solve measured failures.
4. If a persistent domain gap remains, train a parameter-efficient adapter or specialist detector on licensed, consented data and re-run the locked suite.
5. Train a new base model only if the product has a large proprietary dataset, a failure class not addressed by existing models, and an independently reviewed business/safety case.

No training is authorized from user traffic by default. Images must never become training data without explicit consent, provenance, retention, deletion, and governance controls.

## Route-planning choice

VisionAid uses **openrouteservice** for route calculation and OpenStreetMap as its map source. openrouteservice was selected because its engine is open source and supports both `foot-walking` and `wheelchair` profiles, including avoid-step and accessibility-relevant restrictions such as surface, smoothness, kerb, incline, and width when source tags exist.

Official sources:

- [openrouteservice service](https://openrouteservice.org/)
- [openrouteservice routing options](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/routing-options)
- [openrouteservice source](https://github.com/GIScience/openrouteservice)

`POST /api/v1/navigation/route` implements strict coordinate validation, JWT scope enforcement, rate limiting, idempotency, bounded provider calls, response validation, and a typed mobile client. It returns a GeoJSON line, steps, duration, distance, provider attribution, warnings, and these invariant flags:

```json
{
  "safeForAutonomousNavigation": false,
  "requiresMobilityConfirmation": true
}
```

The endpoint does not ship a navigation screen, background location tracking, obstacle avoidance, rerouting, or crossing decisions. Route and accessibility tags can be incomplete, stale, or wrong. A route plan cannot replace a cane, guide dog, orientation and mobility training, or human confirmation.

## Production credential matrix

Do not paste credentials into chat, source code, screenshots, tickets, or an `.env` file that can be committed. Create each secret with least privilege in its provider and place it directly in the deployment secret manager.

| Secret/configuration | Required | Where it belongs | Purpose |
| --- | --- | --- | --- |
| `NVIDIA_COSMOS_API_KEY` | Yes for primary live perception | API deployment secret manager | Bearer credential for the private NIM/vLLM gateway. Generate a dedicated runtime token; do not reuse an NGC provisioning key. |
| `NVIDIA_COSMOS_BASE_URL` | Yes | Server configuration | Private HTTPS base URL ending at the service or `/v1`. Not a client secret, but never expose private infrastructure unnecessarily. |
| `NGC_API_KEY` | Yes only when pulling NVIDIA NIM artifacts | GPU deployment/CI secret manager | Authenticates image/model provisioning. It is not read by the VisionAid API and must not enter the app runtime. |
| `OPENROUTESERVICE_API_KEY` | Yes for the hosted routing service | API deployment secret manager | Server-to-server route requests. A self-hosted deployment should still use a private gateway credential. |
| `UPSTASH_REDIS_REST_TOKEN` | Yes in strict production | API deployment secret manager | Distributed rate limiting and idempotency. |
| Identity-provider signing/admin secrets | Provider-dependent | Identity deployment secret manager | The VisionAid API itself validates public JWKS and does not require a shared JWT signing secret. Never ship an IdP admin or client secret to the app. |
| `OPENAI_API_KEY` | Optional rollback only | API deployment secret manager | Used only when `VISION_PROVIDER=openai`. |

Required non-secret production values are `VISIONAID_RUNTIME_ENV=production`, `VISION_PROVIDER=nvidia`, `NVIDIA_COSMOS_MODEL`, `AUTH_JWKS_URL`, `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_REQUIRED_SCOPE`, `AUTH_NAVIGATION_SCOPE`, `UPSTASH_REDIS_REST_URL`, `OPENROUTESERVICE_BASE_URL`, and exact `ALLOWED_ORIGINS`.

Any observability, deployment, app-store, signing, or notification credentials must be added only when that service is actually selected and implemented. There is no safe or accurate universal key list independent of the chosen vendors.

## Release gates

Before private pilot:

- pin the exact model and container digest; do not deploy a moving alias;
- record license review and model/data provenance;
- pass object-label precision, task-required recall, bounding-box quality, hallucination, and safety thresholds on the locked dataset;
- validate route geometry, step-free claims, no-route behavior, stale/missing map tags, and reroute failure on representative launch geography;
- complete VoiceOver/TalkBack testing with blind and low-vision participants;
- run load, outage, timeout, cancellation, auth, replay, and cost-exhaustion tests;
- document provider, gateway, map, cache, and platform retention;
- keep street-crossing authorization at zero cases in the adversarial suite.

Passing unit tests proves contract behavior, not real-world perception or mobility safety.
