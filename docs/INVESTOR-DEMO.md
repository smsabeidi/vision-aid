# VisionAid investor demo

## Goal

Show a credible end-to-end MVP in six minutes:

1. A blind or low-vision user can start a visual task without navigating a dense camera interface.
2. The result is concise, spoken, and supported by observations.
3. The product communicates uncertainty and high-consequence boundaries.
4. The architecture protects the model key and includes a deterministic, clearly disclosed demo path.

The demo proves that the product loop is implemented. It does not prove model accuracy, product-market fit, accessibility conformance, or production readiness.

## Choose the right mode

### Primary: deterministic demo mode

Use this for the core presentation. It is one repeatable Describe fixture, needs no camera or model key, and is launched from **Run guided demo** on Home when **Show sample demo** is enabled in Settings.

Demo mode does not analyze the captured image. Say this plainly:

> “For presentation reliability, this run uses a clearly labeled deterministic fixture through the same result contract. I’ll show the live model path separately if time and connectivity allow.”

### Optional: live AI mode

Use only as a bonus proof point. It requires a configured private NVIDIA Cosmos endpoint and server-side gateway credential, a reachable API route, provider availability, and a good image.

Do not switch silently between live and demo results. Point to the explicit `LIVE AI · GENERATED RESULT` or `DEMO · SAMPLE RESULT` badge. The shipped live capture flow shows transient failures instead of falling back to a fixture; when the server has no API key, live analysis fails closed with a configuration error.

## Preflight checklist

Complete this on the exact presentation device and network.

### Build and quality

- [ ] Use a known commit and record its hash.
- [ ] Run `npm ci` from the committed lockfile.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run build:web` if presenting the web build.
- [ ] Confirm no secret is present in version control or a public client variable.

### Device

- [ ] Charge the device and disable low-power interruptions.
- [ ] Grant camera and photo permissions, then also rehearse permission denial.
- [ ] Set a predictable media volume and disable unrelated notifications.
- [ ] Confirm speech output is audible through the intended speakers.
- [ ] Confirm screen mirroring does not suppress device audio.
- [ ] Confirm system text size and display zoom do not clip primary actions.
- [ ] Rehearse with VoiceOver or TalkBack on a physical device.

### App state

- [ ] Keep **Show sample demo** enabled for the primary script.
- [ ] Enable auto-speak.
- [ ] Enable history if the history moment is part of the script.
- [ ] Clear old history so the demo starts in a controlled state.
- [ ] Set the desired theme and confirm contrast on the projector.
- [ ] Prepare one low-consequence live-analysis image if live mode will be shown.

### Backup

- [ ] Keep a second device or local web build ready.
- [ ] Keep screenshots or a short recording of the same build as a last-resort visual aid.
- [ ] Keep the repository and architecture diagram available for technical questions.
- [ ] Never paste or display the API key during recovery.

## Six-minute script

### 0:00–0:40 — The problem

Show the Home screen.

Talk track:

> “When a visual task blocks someone, a generic paragraph about the scene is often not enough. VisionAid starts with intent: describe what is here, read visible text, or verify one specific thing. The goal is independent task completion with evidence and honest uncertainty.”

Point out the three large mode cards and the minimal navigation. If using a screen reader, swipe through them so the semantic labels and selected state are audible.

### 0:40–1:50 — Guided Describe demo

1. Choose **Run guided demo**.
2. Point out the **Interactive demo** and **Guided sample** disclosures.
3. Let the result speak.

Expected deterministic summary:

> “A bright kitchen counter is in front of you with a mug, a cereal box, and a set of keys.”

Talk track:

> “The answer is short. Details are separate: the mug is central, the keys are to its right, and the counter edge is visible. That structure is intentional—we make the evidence inspectable instead of hiding it inside polished prose.”

Show the model-estimated confidence, safety guidance, the `DEMO · SAMPLE RESULT` provenance badge, and the manual speech control.

### 1:50–2:40 — Intent and capture

1. Return to Home.
2. Swipe through Describe, Read, and Verify with VoiceOver or TalkBack.
3. Open Verify to show the live camera, framing guidance, mode selector, gallery action, large capture target, and the optional task-specific text field.
4. Return without submitting a live request.

Talk track:

> “The built product supports three live intents. Verify lets the user ask a narrow question instead of receiving a generic narration. Camera permission recovery, gallery import, retry states, and capture guidance are all accessible. I’m keeping model inference out of the deterministic core demo; the live appendix shows it when the environment is configured.”

### 2:40–3:30 — Safety behavior

Show the safety panel in the guided result and then the release gates in [Safety](SAFETY.md) or [Evals](EVALS.md).

Talk track:

> “A fluent answer is not a safety guarantee. The server evaluates the query and generated text for navigation, emergency, medication, medical, financial, legal, and identity risk. Critical navigation or emergency action verdicts are replaced with an abstention. This is defense in depth, and high-consequence use remains outside scope.”

If a live environment is configured, the appendix can demonstrate the synthetic query “Is it safe to cross the street now?” It must produce the critical safety treatment before it can be shown; never run the scenario in real traffic.

### 3:30–4:20 — User control

1. Open History and show the prior results.
2. Open Settings.
3. Point out auto-speak, haptics, theme, history, and demo controls.
4. Clear local history or explain the control.

Talk track:

> “The API route stores no image or history. Saving results is optional and local to the app. The user can disable or clear it. Live images cross the network only after an intentional capture or import.”

Do not claim local history is app-level encrypted unless that has been implemented and verified.

### 4:20–5:20 — Architecture

Show the diagram from [Architecture](ARCHITECTURE.md).

Talk track:

> “The client owns capture and the accessible experience. A versioned server boundary verifies short-lived identity, validates and deduplicates the request, enforces distributed traffic controls, routes by task and risk, invokes the model with storage disabled and bounded resilience, validates strict output, and applies safety policy. The same typed result contract supports deterministic demos, model changes, specialist OCR, and future human escalation.”

### 5:20–6:00 — Investment thesis

Talk track:

> “The model is not the moat. The thesis is a compounding system around task completion: accessibility execution, capture guidance, risk-labeled evals, specialist routing, and consented outcome data. This MVP proves the loop. The next evidence is measured task success with blind and low-vision users.”

Then stop. Leave the final screen on the concise result, not a settings menu or terminal.

## Optional live appendix

Live mode is evidence that the integration works on the chosen examples, not an accuracy benchmark.

### Read visible text

1. Choose **Read** and select a prepared, non-sensitive package image.
2. Show that the result prioritizes visible text and asks for recapture when small print is unclear.
3. Point to `LIVE AI · GENERATED RESULT`.

Talk track:

> “Read changes both the instruction and output priority. Specialist OCR is a roadmap routing layer; this MVP uses the common multimodal contract.”

### Verify a detail

1. Choose **Verify**.
2. Enter a narrow, low-consequence question such as “Where are the keys?”
3. Capture or select the prepared scene.
4. Show the narrow answer, evidence, and single-image uncertainty.

Talk track:

> “Verify is the proposed wedge: answer the user's task instead of narrating everything. The research question is whether this materially improves completion versus existing tools.”

Avoid medication, traffic, allergens, money, identity, or dangerous scenarios except the rehearsed synthetic safety-policy test.

## Technical proof points

If an engineer asks what is real, answer precisely:

- Expo SDK 57 universal client with camera, gallery, speech, haptics, local preferences/history, and screen-reader semantics.
- `POST /api/v1/analyze` validates identity, origin, content type, keys, mode, query, image format, payload sizes, and idempotency.
- Production uses an atomic distributed 20-request-per-principal-per-minute guard; development alone can use the bounded in-memory fallback.
- Live calls use NVIDIA Cosmos 3 Nano Reasoner through a private server endpoint, strict structured output, and grounded objects; OpenAI remains a rollback provider.
- The repository includes a guarded openrouteservice route-planning API, but no turn-by-turn navigation UI or street-crossing authority. Do not demo it as a finished mobility product.
- Provider calls have bounded retries, controlled rollback behavior, circuit breaking, correlation, and privacy-minimized telemetry.
- Safety classification runs against the user query and returned model text.
- Critical navigation/emergency results have their action verdict overridden.
- The OpenAI rollback sets `store: false`; application telemetry excludes images, queries, and generated text, while infrastructure retention still requires deployment governance.
- A deterministic guided fixture and typed error handling make the demo resilient without silently replacing failed live-photo analysis.
- Tests cover validation, rate limiting, safety policy, response parsing, and deterministic behavior.

Do not claim:

- Proprietary or fine-tuned models.
- On-device AI inference.
- Calibrated accuracy across real-world cohorts.
- Completed compliance, uptime evidence, or incident-response validation.
- A completed external accessibility/security/privacy audit.
- Customers, pilots, revenue, retention, or a proprietary dataset.

## Failure recovery

| Failure | What to do | What to say |
| --- | --- | --- |
| Camera permission denied | Use the permission recovery action or gallery import. | “Permission recovery is part of the accessible path.” |
| Live request times out | Identify the error/source; switch to disclosed demo mode. | “The live provider timed out, so I’m moving to the deterministic product fixture.” |
| No API key | Use demo mode; never expose the environment file. | “This environment intentionally has no live provider credential.” |
| Speech is inaudible | Use manual Speak; increase device volume; read the visible summary. | “The same result is available visually and through on-demand speech.” |
| Screen mirroring fails | Continue on the backup device or recorded build. | “I’m switching display paths; the build and flow are unchanged.” |
| Unexpected model result | Do not reinterpret or defend it. Show uncertainty/retry, then return to demo mode. | “That is exactly why model quality is managed with abstention and regression evals.” |
| Demo fixture does not match photo | Remind the audience it is a deterministic fixture. | “This mode demonstrates the product contract, not analysis of this photo.” |

## Likely investor questions

### “Why will Apple, Google, Microsoft, or a model vendor not absorb this?”

General visual description is already commoditized. The defensible thesis is not access to a vision model; it is superior completion of narrowly defined tasks through capture guidance, accessibility execution, risk-specific evals, recovery, and organization-specific workflows. That thesis still needs evidence.

### “What is proprietary today?”

The integrated product implementation and safety/evaluation framework. There is not yet a proprietary dataset or model. The data moat begins only with explicit consent and demonstrated task outcomes.

### “What is the wedge?”

Verify a concrete, low-consequence visual detail with grounded evidence. Research must determine the highest-frequency workflow where existing products fail materially.

### “How do you make money?”

The hypotheses are a consumer advanced-workflow tier and B2B organization-specific assistance. Pricing and channel decisions follow task and retention evidence.

### “What prevents harmful hallucinations?”

Nothing makes a perception model infallible. The system constrains intent and output, validates schemas, classifies risk, exposes uncertainty, overrides critical actions, and defines stop-ship eval gates. High-consequence use remains outside scope.

### “Why show demo mode?”

It separates product demonstration from provider variability and makes provenance testable. It is explicitly not model-performance evidence. Live mode can be demonstrated separately.

### “What would the next capital unlock?”

Paid task research, a representative consented evaluation corpus, capture-quality and specialist routing, production safety/privacy/accessibility work, and one narrow pilot with task-completion measurement.

## After the meeting

Record:

- Which task and differentiation questions repeated.
- Which claims confused the audience.
- Whether demo provenance was understood.
- Where the flow required presenter explanation.
- Requests for diligence artifacts, benchmarks, or pilot design.

Turn those observations into product and diligence work. Do not convert investor enthusiasm into evidence of user demand.
