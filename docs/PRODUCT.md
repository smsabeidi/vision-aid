# VisionAid product brief

## Product statement

VisionAid helps blind and low-vision people answer a concrete question about what is in front of them by turning an intentional camera capture into a concise answer, visible evidence, uncertainty, and spoken output.

The product is not “a camera that talks.” The product thesis is that independence improves when AI supports reliable task completion: it helps the user capture the right evidence, answers only what the image supports, and makes uncertainty actionable.

## Stage and evidence

The company now treats the product ideal as validated and has entered funded production hardening. The repository demonstrates the implemented product and release architecture; it does not contain the external research or commercial evidence behind that validation, so unsupported performance or market claims must still not be inferred from code.

What is established:

- The application implements a focused capture-to-result loop.
- The three interaction modes—Describe, Read, and Verify—map to distinct user intents.
- The guided demo provides one deterministic, clearly labeled Describe walkthrough.
- The experience includes accessibility semantics, speech, local preferences, and optional local history.
- Live analysis can be routed through a server-side multimodal model integration.
- The live API now has a versioned, authentication-ready, idempotent, distributed-control boundary, NVIDIA Cosmos 3 grounded perception, and an OpenAI rollback path.
- A guarded pedestrian/step-free route-planning API exists as infrastructure; no user-facing turn-by-turn experience is shipped.

What is not yet established:

- Measured task-completion improvement over existing tools.
- Retention, willingness to pay, acquisition efficiency, or market size for a chosen wedge.
- Production model quality across representative users and environments.
- Accessibility conformance based on an independent audit.
- Completed external security, privacy, accessibility, load, or regulatory sign-off.

No pilot results, customers, revenue, partnerships, proprietary dataset, or accuracy claims should be inferred from this MVP.

## Primary user and job

Initial user:

> A blind or low-vision smartphone user who is comfortable with a screen reader and needs quick visual confirmation about an object, printed content, or state in a non-emergency setting.

Core job:

> “When I cannot independently confirm something visual, help me gather usable evidence and complete the task without making me decode a long generic description.”

Examples:

- Describe the objects and layout visible on a desk.
- Read the important text on a package or notice.
- Verify whether the visible label says “decaf.”
- Verify which setting is visibly selected on a photographed control.

## Product principles

1. **Intent before inference.** Ask what the user is trying to do, then analyze for that task.
2. **Evidence before eloquence.** Prefer a short grounded answer over an expansive plausible one.
3. **Uncertainty is a feature.** Say what is unclear and how the user might capture better evidence.
4. **Accessible by construction.** Screen-reader semantics, speech, large targets, and predictable focus are core functionality.
5. **User-initiated sensing.** Analyze only an image the user intentionally captures or selects.
6. **Local control by default.** Make saved history optional, visible, and deletable.
7. **High-consequence abstention.** Do not turn a perception model into a navigation, medical, or emergency authority.

## MVP scope

### Implemented in this repository

| Area | MVP behavior |
| --- | --- |
| Home | Entry points for Describe, Read, and Verify; demo discoverability; recent activity. |
| Capture | Rear-camera capture, gallery selection, mode selection, framing guidance, permission fallback, progress, errors, and retry. |
| Describe | Concise scene summary plus supporting observations. |
| Read | Text-focused analysis with organized output. |
| Verify | Narrow question answered from visible evidence. |
| Result | Answer, details/evidence, uncertainty or safety note, and speech controls. |
| History | Optional local persistence, empty state, item detail, and clear-all control. |
| Settings | Theme, auto-speak, haptics, save-history, demo-mode, and privacy controls. |
| Guided demo | One clearly labeled, deterministic Describe fixture that needs no camera or model availability. |
| Live analysis | Versioned server API using NVIDIA Cosmos 3 Nano Reasoner for grounded perception, with an OpenAI rollback provider. |
| Route planning | Guarded openrouteservice pedestrian/step-free backend and typed client; not exposed as autonomous or turn-by-turn navigation. |

### Explicit non-goals for the MVP

- Continuous or background camera monitoring.
- Turn-by-turn navigation, obstacle avoidance, or street-crossing decisions.
- Medical diagnosis, medication identification/dosage, or emergency decisions.
- Face recognition or identification.
- Interpretation of legal or financial documents for consequential decisions.
- A claim of replacing a screen reader, cane, guide dog, sighted assistant, clinician, or emergency service.
- Human-agent handoff.
- A proprietary model, fine-tuned model, wearable, or custom hardware.

## Experience contract

Every successful analysis should answer four questions:

1. **What is the answer?** A concise task-specific response.
2. **What supports it?** Concrete observations or extracted text.
3. **How certain is it?** Plain-language uncertainty, never model jargon presented as a guarantee.
4. **What should I do next?** Reframe, recapture, ask a narrower question, or verify another way when appropriate.

The interface should never hide a low-confidence or safety-relevant caveat beneath a visually polished result.

## Core journeys

### Describe a scene

1. User chooses **Describe**.
2. App opens the camera or gallery.
3. User captures/selects an image.
4. App checks the request and processes it in demo or live mode.
5. Result states the scene summary, relevant details, and uncertainty.
6. Result is spoken automatically when enabled, or on demand.
7. Result is saved locally only when history is enabled.

### Read visible text

1. User chooses **Read**.
2. Capture guidance encourages a close, stable, well-lit image.
3. Result prioritizes extracted text and useful structure.
4. If text is clipped, blurred, or ambiguous, the result asks for a better capture rather than completing missing text.

### Verify a detail

1. User chooses **Verify** and can enter a narrow question; a generic verification request is used if left blank.
2. Model receives the question with the user-selected image.
3. Result answers yes, no, unclear, or an equally narrow factual response only when the evidence supports it.
4. Ambiguity produces an abstention and recapture guidance.

## Differentiation and moat thesis

The category already contains capable general visual assistants. VisionAid should not claim defensibility from model access or generic scene description.

The proposed moat is a compounding task-reliability system:

- **Task-specific interaction data:** with explicit consent, learn which capture guidance and answer formats lead to successful completion—not merely which descriptions users request.
- **Risk-labeled evaluation corpus:** a representative, consented benchmark organized by task, environment, assistive workflow, and consequence severity.
- **Capture-to-completion optimization:** combine capture quality, intent routing, specialist tools, multimodal reasoning, abstention, and recovery into a measurable system.
- **Accessibility execution:** a consistently excellent screen-reader and speech workflow is difficult to reproduce through a model wrapper alone.
- **Domain distribution:** organization-specific workflows and trusted knowledge can create durable B2B value after the consumer task loop is validated.

This is a thesis, not a current asset. The MVP does not yet contain a proprietary dataset, trained model, network effect, or exclusive distribution.

## Business hypothesis

The MVP is compatible with two potential paths:

1. **Consumer:** free core assistance with a paid tier for higher usage, advanced workflows, and trusted-human verification.
2. **B2B/B2B2C:** organization-specific assistance for employers, education, retail, travel, or public services, sold on workflow completion, privacy, administration, and support.

The team should not commit to pricing before validating a high-frequency task and measuring incumbent failure. The investor demo should present these as hypotheses.

## Metrics

### North-star metric

**Independent task completion rate:** percentage of initiated, in-scope tasks the user completes correctly without unplanned sighted assistance within the task time limit.

### Quality and trust

- Confidently incorrect answer rate.
- Correct abstention rate on unanswerable or high-risk inputs.
- Recovery rate after capture guidance.
- Evidence-grounding rate.
- User trust calibration: reliance when correct and verification when uncertain.
- Screen-reader task success and time on task.

### Product

- Successful tasks per weekly active user.
- Seven-day and 28-day retained task users.
- Repeat use by task type.
- Analysis completion and abandonment rates.
- History and speech-control adoption.

### System and economics

- End-to-end p50 and p95 analysis latency.
- Model/provider error rate.
- Cost per successful task, not cost per API call.
- Image payload size and token consumption by task type.

No metric has a measured baseline in the repository. Proposed definitions and release gates are in [Evals](EVALS.md).

## From MVP to product

Roadmap items are ordered by learning value, not promised dates:

1. Run moderated, paid task studies with blind and low-vision users.
2. Instrument privacy-preserving task outcomes and failure reasons with explicit consent.
3. Build the representative evaluation corpus and regression harness.
4. Add capture-quality checks for blur, glare, framing, and text scale.
5. Route tasks between OCR, barcode/object specialists, and multimodal reasoning.
6. Add multi-frame evidence and follow-up questions.
7. Add a trusted-human escalation option with clear consent and data handling.
8. Pilot one organization-specific workflow.
9. Complete independent accessibility, security, privacy, and safety reviews before public launch.

Wearables, continuous video, custom hardware, and on-device model optimization should remain separate discovery tracks until the task and economics justify them.

## Product release gates

The MVP can be shown to investors when:

- The deterministic demo path completes on the presentation devices.
- Live mode, if shown, uses a server-held key and fails safely.
- All safety boundaries are visible and accurately described.
- Typecheck, tests, and the selected production build pass.
- The presenter makes no unsupported customer, performance, accessibility, privacy, or regulatory claims.

A private user pilot additionally requires representative task evals, consent and deletion flows, incident ownership, accessibility testing with target users, and the pilot thresholds in [Safety](SAFETY.md) and [Evals](EVALS.md).
