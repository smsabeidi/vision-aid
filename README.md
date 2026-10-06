# VisionAid

VisionAid is an accessibility-first mobile assistant that helps blind and low-vision people understand a scene, read visible text, and verify a specific detail using a phone camera or an existing photo.

This repository contains the funded production-hardening MVP. The product ideal is treated as validated; the implementation now prioritizes a fail-closed API boundary, task/risk-aware model routing, measurable release controls, and the same accessible end-to-end loop. VisionAid does not replace a cane, guide dog, trained human, medical device, or emergency service.

## MVP at a glance

| Capability | What is in the MVP |
| --- | --- |
| Describe | Produces a concise scene description and supporting observations. |
| Read | Extracts and organizes visible text from a captured or selected image. |
| Verify | Answers a narrow user question about visible evidence in the image. |
| Guided capture | Provides framing guidance, camera permission recovery, gallery selection, retry, and error states. |
| Honest results | Separates the answer, observed details, uncertainty, and a safety note. |
| Accessible output | Supports automatic or on-demand speech, semantic screen-reader labels, large touch targets, live announcements, high contrast, and reduced-motion-friendly interactions. |
| Local controls | Stores preferences and optional analysis history on the device; history can be disabled or cleared. |
| Guided demo | Runs one deterministic Describe walkthrough without a camera, API key, or network-dependent model response. |
| Route-planning foundation | Exposes a guarded pedestrian/step-free route API backed by openrouteservice; no turn-by-turn UI or crossing authorization is shipped. |

The MVP does **not** provide autonomous or turn-by-turn navigation, obstacle avoidance, street-crossing guidance, facial identification, diagnosis, medication or dosage decisions, emergency interpretation, continuous video analysis, or human-agent escalation. The route endpoint is planning support only and always requires mobility confirmation. Those boundaries are intentional. See [Safety](docs/SAFETY.md).

## Architecture

```text
Expo mobile/web client
  camera or gallery
        |
        +-- demo mode --> deterministic local result
        |
        +-- live mode --> POST /api/v1/analyze
                              |
                         JWT + validation + idempotency
                              |
                         distributed traffic controls
                              |
                         vision-provider router
                              |
                         NVIDIA Cosmos 3 Nano Reasoner
                              |
                         grounded, safety-aware result
        |
  result + optional speech + optional local history

Expo client --> POST /api/v1/navigation/route
                      |
                 auth + limits + idempotency
                      |
                 openrouteservice / OpenStreetMap
                      |
                 route plan + mandatory safety flags
```

NVIDIA and routing credentials are read only by server routes. They must never be placed in an `EXPO_PUBLIC_*` variable or bundled into a client build. OpenAI remains an explicit rollback provider. User preferences and saved results are local to the app. Images are sent for live analysis only after the user explicitly captures or selects one.

Read [Architecture](docs/ARCHITECTURE.md) for the component model and trust boundaries.

## Run locally

### Prerequisites

- Node.js 22.13 or newer is recommended; React Native also supports Node 20.19.4 or newer in the Node 20 line
- npm 10 or newer
- For a physical device: Expo Go, or an Expo development build

### 1. Install

```bash
npm ci
cp .env.example .env
```

### 2. Choose an analysis mode

For the fastest, repeatable walkthrough, leave the live provider credentials empty, keep **Show sample demo** enabled in Settings, and choose **Run guided demo** on Home. The guided demo uses a clearly labeled Describe fixture and does not call the model. Read and Verify use the live capture path.

If a live-path request reaches a server without a configured provider endpoint and credential, it fails with a typed configuration error. It never fabricates a sample result. Use **Run guided demo** for the explicit, guaranteed camera-free path.

For live image analysis, add a server-side key to `.env`:

```dotenv
VISION_PROVIDER=nvidia
NVIDIA_COSMOS_BASE_URL=https://your-private-cosmos-endpoint.example/v1
NVIDIA_COSMOS_API_KEY=your_server_to_server_gateway_key
NVIDIA_COSMOS_MODEL=nvidia/cosmos3-nano-reasoner
```

All live perception modes use NVIDIA Cosmos 3 Nano Reasoner by default with one strict grounded-object schema. Set `VISION_PROVIDER=openai` to use the preserved OpenAI rollback path. Never put either provider credential in an `EXPO_PUBLIC_*` variable.

Strict production additionally requires JWT issuer/JWKS configuration, a Redis REST service for atomic rate limiting and idempotency, and an openrouteservice endpoint/key. See [NVIDIA Vision and Navigation](docs/NVIDIA-VISION-NAVIGATION.md), [Production](docs/PRODUCTION.md), and the complete [.env.example](.env.example).

### 3. Start

```bash
npm start
```

Then press `i` for the iOS simulator, `a` for Android, or `w` for web. You can also scan the Expo QR code from a compatible device.

To start directly in a browser:

```bash
npm run web
```

For a native device that cannot reach the API route through the Expo development URL, run the API-capable app server on a reachable host and set:

```dotenv
EXPO_PUBLIC_API_URL=http://YOUR-LAN-IP:8081
```

Only the base URL is public; the API key remains server-side.

## Quality commands

```bash
npm run typecheck   # strict TypeScript validation
npm run lint        # Expo lint rules
npm test            # unit and contract tests
npm run audit:production # high/critical production dependency gate
npm run build:web   # production web export
# or run every gate:
npm run verify
```

## Investor demo

Use the guided Describe demo for the primary presentation because it is deterministic and requires no live service dependency. Keep live Read/Verify as optional technical proof points.

The exact preflight checklist, six-minute talk track, failure recovery, and investor Q&A are in [Investor Demo](docs/INVESTOR-DEMO.md).

## Privacy and safety

- Analysis begins only after an explicit capture or gallery selection.
- Demo mode does not upload the selected image for model analysis.
- Live mode sends the image and task to the configured server route and model provider.
- The API key stays on the server.
- Saving history is user-controlled and local; users can clear it.
- A model answer can be wrong even when it sounds fluent. The UI exposes uncertainty and tells the user when to verify another way.
- VisionAid must not be used for mobility, medical, emergency, legal, or other high-consequence decisions.

This MVP has not yet completed a security audit, independent accessibility audit, clinical validation, regulatory review, or a production privacy assessment. Do not represent it as production-ready.

## Repository map

```text
app/                     Expo Router screens and server API route
components/              Reusable accessible UI components
hooks/                   Settings, history, storage, and accessibility hooks
lib/                     Analysis client, domain types, storage, and utilities
styles/                  Theme tokens and adaptive colors
types/                   Shared analysis request/result contracts
utils/                   Local result and preference persistence
assets/                  App icon and packaged visual assets
tests/                   Unit and contract tests
.github/workflows/       Continuous integration checks
docs/
  PRODUCT.md             Product strategy, scope, metrics, and moat thesis
  ARCHITECTURE.md        System design, data flows, and scaling path
  NVIDIA-VISION-NAVIGATION.md  Model/routing choice, deployment, keys, safety, and training decision
  SAFETY.md              Safety boundaries, risks, and release gates
  EVALS.md               Evaluation framework and proposed thresholds
  INVESTOR-DEMO.md       Demo preparation, script, and claims discipline
.env.example             Environment variable template
app.json                 Expo app and permission configuration
eas.json                 Expo Application Services build profiles
package.json             Scripts and dependencies
```

## Product status

This is the production-hardening MVP. The model and API path now includes NVIDIA Cosmos 3 grounded perception, an OpenAI rollback provider, guarded pedestrian/step-free route planning, versioning, JWT verification hooks, exact-origin CORS, distributed atomic traffic controls, idempotency, request correlation, strict structured output, bounded retries, a circuit breaker, privacy-minimized telemetry, health readiness, and CI gates. The route foundation is not a user-facing navigation release. External GPU/identity/Redis/routing resources, real-image and route eval data, load SLO evidence, and independent reviews remain stop-ship prerequisites—not hidden gaps.

For the full product thesis and release plan, read [Product](docs/PRODUCT.md), [Production](docs/PRODUCTION.md), and [Evals](docs/EVALS.md).
