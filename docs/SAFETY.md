# VisionAid safety and privacy

## Purpose

VisionAid converts camera evidence into language. That can be useful, but it creates a specific hazard: a fluent answer can sound more reliable than the underlying image or model warrants.

The MVP therefore treats safety as a product contract:

- Use it for low-consequence visual assistance.
- Show what the answer is based on and when it is uncertain.
- Abstain or require human confirmation for high-consequence requests.
- Never position the app as a navigation, medical, emergency, identity, legal, or financial authority.

This document describes implemented controls and the additional gates required before real-world release. It is not a certification or guarantee.

## Safe-use boundary

### Intended use

- Describing a non-hazardous scene.
- Reading ordinary visible text when the user can tolerate an error or verify another way.
- Verifying a narrow, non-consequential detail supported by the image.
- Pre-trip pedestrian or step-free route planning in controlled research, with explicit mobility confirmation and no crossing or obstacle-avoidance decisions.
- Practicing the product flow in clearly disclosed demo mode.

### Prohibited reliance

Do not rely on VisionAid for:

- Street crossing, autonomous or turn-by-turn guidance, obstacle avoidance, driving, cycling, or operation of machinery.
- Emergency recognition or instructions.
- Diagnosis, symptoms, treatment, medication identity, medication dosage, or food/allergen safety.
- Identity, face recognition, access control, or deciding whether a person is trustworthy.
- Legal, financial, employment, insurance, or eligibility decisions.
- Firearms, hazardous materials, electrical hazards, or other dangerous equipment.
- Any situation where an incorrect answer could cause injury, loss of rights, or material financial harm.

In these cases, the user should use an appropriate accessible tool, trained person, professional, or emergency service.

## Risk model

| Risk tier | Example | Required behavior |
| --- | --- | --- |
| Low | “Describe the objects on this desk.” | Answer from visible evidence; disclose material uncertainty. |
| Moderate | “Does this package say decaf?” | Give a narrow answer; cite the visible evidence; ask for a clearer capture when ambiguous. |
| High | “Is this the right medication?” | Do not provide an action-authorizing answer; require human/professional confirmation. |
| Critical | “Is it safe to cross now?” | Refuse the decision and direct the user to a safe mobility method or emergency resource as appropriate. |

Risk depends on both the request and context. A text-reading task may be low risk for a greeting card and high risk for dosage instructions. Classification is defense in depth, not an infallible detector.

## Implemented MVP controls

### Before inference

- User explicitly captures or selects the image.
- API accepts only the documented request keys and modes.
- Data-URI MIME, Base64 structure, decoded image signature, declared length, and decoded size are validated.
- Production verifies short-lived JWTs against configured JWKS/issuer/audience/scope.
- An atomic distributed fixed-window guard allows 20 requests per authenticated principal per minute; development alone has a bounded in-memory fallback.
- Idempotency prevents duplicate provider work across safe client retries.

### During inference

- Model credentials remain on the server.
- Live requests use a constrained task instruction and strict JSON-schema output.
- NVIDIA Cosmos 3 Nano Reasoner is called through a private authenticated NIM/vLLM endpoint; the OpenAI rollback request sets `store: false`.
- A hard upstream timeout prevents indefinite processing.
- Mode-specific instructions and output/time budgets are explicit; provider selection is release configuration.
- One bounded transient retry and a circuit breaker reduce outage amplification.
- Image text and user text are explicitly treated as untrusted data, not system instructions.
- The model instruction prohibits action verdicts for high-stakes situations and requests detected risk categories in structured output.

### After inference

- Server validates model output before returning it.
- Grounded-object labels, evidence, confidence, and normalized boxes are validated but are not represented as complete obstacle detection.
- A server-side classifier evaluates the user query and returned model text for navigation, medical, medication, financial, legal, emergency, and identity risk.
- High-consequence intent escalates risk and human-confirmation guidance.
- Results expose confidence, safety status, human-confirmation requirements, and guidance.
- UI separates the main answer from evidence/details and safety or uncertainty messaging.
- Provider errors are normalized without exposing secrets.
- Users can retry, recapture, or use another verification method.
- Analysis history is optional, local, and clearable.

### Route planning

- The route endpoint validates coordinates, profile, authentication scope, rate limits, and idempotency before contacting openrouteservice.
- Pedestrian and step-free preferences are requested, but their reliability depends on OpenStreetMap coverage and tagging.
- Every valid route states that it is unsafe for autonomous navigation and requires mobility confirmation.
- The endpoint cannot authorize a crossing and does not receive live camera, obstacle, or signal-state evidence.

### Demo mode

- Produces deterministic, mode-specific sample results.
- Does not represent analysis quality for the captured image.
- Avoids a live model call.
- Returns `source: 'demo'` so the application can disclose provenance.

The presenter and product must never imply that a deterministic fixture is a live analysis result.

## Known limitations

- A single image may be blurry, clipped, dark, reflective, occluded, stale, or misleading.
- The model may hallucinate text, objects, spatial relationships, or certainty.
- Object labels and boxes may be missed, duplicated, mislocalized, or attached to the wrong evidence.
- Confidence values are model-estimated communication aids, not calibrated probabilities unless validated by task-specific evals.
- Safety classification may miss indirect, multilingual, misspelled, or context-dependent risky requests.
- Text embedded in a scene, QR code, label, or sign may contain adversarial instructions.
- A correct description may still be unsafe to act upon because the camera does not show the whole environment.
- Speech can amplify an erroneous result and may expose it to bystanders.
- Local history can contain sensitive images or derived text and is not claimed to be encrypted by the app.
- OpenStreetMap route/accessibility data may be missing, stale, or wrong, especially for steps, kerbs, surface, incline, width, construction, and temporary closures.
- A route result can be geometrically valid and still be unsafe or inaccessible in current conditions.
- Provider request flags do not by themselves establish the full network, proxy, serving-stack, or infrastructure retention policy.
- Demo provenance can still be misunderstood. Live mode now fails closed when model configuration is absent and never silently returns the deterministic fixture.

## Privacy model

### Data minimization

- Do not activate the camera or submit an image without a user action.
- Send only the selected image, task mode, and optional user query needed for analysis.
- Keep no source image or raw-query history in the API route. Validated analysis and route results are retained in the distributed idempotency store for bounded replay and must be disclosed in the production retention inventory.
- Do not collect remote product analytics in the MVP.
- Save history only when the user enables that setting.

### User controls

- Camera and gallery access remain subject to operating-system permission controls.
- Demo mode can be used without submitting the image to a model provider.
- History saving can be disabled.
- Saved local history can be cleared.
- Automatic speech can be disabled.

### Production governance still required

- A plain-language privacy notice tied to the deployed operator and jurisdictions.
- Documented subprocessors, data regions, retention, deletion, and legal basis.
- Redaction and retention controls for CDN, API, platform, and error logs.
- Data-subject request handling when accounts or remote data exist.
- Consent and governance for any research or evaluation data.
- Independent threat model/penetration test and an exercised breach-response process.
- Child-safety and age-appropriate design decisions.

## Accessibility safety

For this product, inaccessible recovery is a safety issue. A user must be able to understand state and exit or retry without sighted assistance.

Implemented design targets include semantic labels, roles and hints; selected, disabled, and busy states; 48px-or-larger primary targets; live announcements; high contrast; and reduced-motion-friendly interactions.

Before a user pilot, test the complete flow with VoiceOver and TalkBack on physical devices, including:

- First-run camera denial and subsequent permission recovery.
- Focus order after navigation, error, retry, and result arrival.
- Speech interruption and replay.
- System text scaling and orientation where supported.
- Empty history and destructive clear confirmation.
- Offline, timeout, and upstream-error states.
- Disclosure when a result came from demo fallback.

Automated checks are useful but cannot replace testing with blind and low-vision participants.

## Threat and abuse cases

The safety program must test at least:

- Prompt injection printed in an image or encoded in a QR code.
- Oversized, corrupt, polyglot, or mislabeled image payloads.
- Requests that hide a high-risk decision inside an ordinary task.
- Medication, allergens, currency, legal forms, and identity questions.
- Navigation questions with incomplete field of view.
- Adversarial follow-up wording intended to bypass refusal.
- Images containing faces, documents, addresses, children, nudity, or credentials.
- Replay, scraping, cost exhaustion, and automated high-volume requests.
- Provider outage, partial response, malformed structured output, and timeout.
- Demo provenance being omitted, inaudible, or misunderstood.

## Incident severity

| Severity | Definition | Example | Response expectation |
| --- | --- | --- | --- |
| S0 | Immediate risk of serious physical harm or broad sensitive-data exposure | Street-crossing action authorized; exposed API secret | Disable affected path, preserve evidence, notify accountable owner immediately. |
| S1 | High-consequence incorrect answer or sensitive-data disclosure | Medication confirmation; private image in logs | Stop rollout, investigate, remediate, and add a regression case before restart. |
| S2 | Material task failure without high-consequence harm | Confidently wrong package label | Triage promptly, measure prevalence, fix or narrow scope. |
| S3 | Low-impact usability or presentation defect | Speech replay label is confusing | Track and prioritize normally. |

The production organization must assign named incident, privacy, security, accessibility, and model-risk owners. This repository does not constitute an operations program.

## Release gates

### Investor demonstration

- Demo provenance is visible and stated aloud.
- The presenter uses only low-consequence scenarios.
- No performance or user-impact claim is made from deterministic fixtures.
- Live mode is optional and has a rehearsed safe failure path.
- API key is server-side and absent from version control.
- Tests and typecheck pass on the demonstrated commit.

### Moderated research

- Informed-consent script and participant compensation are established.
- Images are not retained for research unless separately and explicitly consented.
- Participants receive clear safe-use boundaries.
- A researcher can intervene; no high-consequence scenario is used.
- Accessibility testing covers the target devices and assistive technologies.
- Every failure has a severity label and an owner.

### Private pilot

- Representative evaluation set and thresholds in [Evals](EVALS.md) pass.
- High-risk requests abstain or require human confirmation in the full safety suite.
- No open S0/S1 defect exists.
- Authentication, rate limiting, abuse controls, monitoring, and kill switches exist.
- Security, privacy, accessibility, and model-risk reviews are signed off.
- Provider and infrastructure retention are documented and configured.
- Incident response and user-support paths are operational.

### Public production

- Independent accessibility and security assessment is complete.
- Reliability and rollback targets are met under load and provider failure.
- Legal and regulatory analysis covers actual claims, markets, and data flows.
- User outcome and trust metrics meet predefined thresholds across representative cohorts.
- The product has a demonstrated process for model/provider changes and regression approval.
- Marketing claims match reproducible evidence.

## Stop-ship conditions

Any of the following blocks release:

- A live API key appears in a client bundle, log, repository, demo recording, or analytics payload.
- A critical navigation, emergency, medication, or medical request receives an action-authorizing answer.
- A route response omits the non-autonomous warning/confirmation invariants or represents incomplete accessibility tags as guaranteed.
- Demo output is presented as live model evidence.
- The app has no screen-reader-accessible path to recover from permission, network, or model errors.
- A material image or result retention path is undisclosed or cannot be disabled/deleted as promised.
- An S0 or S1 issue is open without an approved containment.
- The evaluated model, prompt, schema, or safety classifier differs from the release candidate.

## Reporting a vulnerability

The MVP does not yet publish a production security contact. Before external distribution, add a monitored security address, coordinated-disclosure policy, expected response times, and an incident intake path. Do not ask users to include sensitive images or secrets in a bug report.
