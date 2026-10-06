# VisionAid evaluation program

## Why evals are the product

VisionAid is only useful when it improves a user's ability to complete a task without creating unsafe reliance. Generic model benchmarks and persuasive sample outputs cannot establish that.

The evaluation unit is therefore a **task episode**:

```text
user intent -> capture -> analysis -> answer/evidence -> user action -> outcome
```

The MVP includes domain tests for validation, safety, deterministic demo behavior, and model-response parsing. It does not yet include a representative real-image benchmark or measured user-task results.

All numerical thresholds below are proposed release gates, not achieved results.

## Evaluation layers

### 1. Deterministic software tests

Run on every change:

- Request shape and unsupported-key rejection.
- Image data-URI type, Base64, decoded size, and body-size validation.
- Query and mode validation.
- Error-code and retryability mapping.
- Local/distributed rate-limit decisions, trusted edge-key selection, and typed responses.
- JWT fail-closed posture, request correlation, idempotency claim/replay/conflict, and production readiness.
- Task/risk model routing, prompt construction, fallback selection, bounded retries, and circuit state.
- NVIDIA request construction, grounded-object schema/boxes, provider selection, and OpenAI rollback.
- Pedestrian/step-free route request mapping, route response validation, non-autonomous invariants, and navigation-client retry identity.
- Upstream response extraction and strict parsing.
- Demo determinism and provenance.
- Safety category classification and policy enforcement.
- Client timeout, cancellation, and fallback behavior.
- Local storage serialization/migration behavior.
- Accessibility component states where automation is feasible.

Command:

```bash
npm test
```

### 2. Model regression set

A versioned, consented dataset representing the intended task distribution. Each case includes:

- Image or image set.
- Task mode and exact user query.
- Ground-truth observable facts and acceptable answer variants.
- Required object labels, normalized reference boxes/regions, and acceptable localization tolerance.
- Facts that must not appear because they are unsupported.
- Risk tier/category.
- Expected abstention or human-confirmation behavior.
- Capture-quality attributes.
- Environment and device metadata that is relevant and consented.
- Annotation provenance and adjudication state.

Run it whenever the model, prompt, schema, safety classifier, image transform, routing, or provider changes.

### 3. Route regression set

A versioned launch-geography set must cover pedestrian and step-free origin/destination pairs, known steps, kerbs, surfaces, inclines, missing tags, disconnected networks, temporary closures, and no-route cases. Ground truth requires field verification or an accountable accessibility-data source with a recorded observation date.

The suite measures geometry validity, route feasibility, accessibility-claim precision, no-route behavior, instruction consistency, stale-data warnings, latency, and whether every response preserves the non-autonomous/confirmation invariants. It must never use route-provider output as its own ground truth.

### 4. Adversarial safety suite

Curated cases for:

- Navigation and street-crossing requests.
- Emergency scenes and instructions.
- Medication, medical, allergen, and dosage requests.
- Identity and face-recognition requests.
- Legal and financial action requests.
- Dangerous tools, machinery, fire, and electricity.
- Printed prompt injection and malicious QR content.
- Indirect, misspelled, multilingual, and euphemistic unsafe intent.
- Corrupt, oversized, adversarial, or mislabeled image payloads.
- Provider timeout, malformed output, refusal, and partial response.
- Routes that contain known steps or inaccessible/closed segments despite a step-free request.
- Requests to authorize a crossing or treat route geometry as live obstacle evidence.

### 5. Accessibility task testing

Test on physical iOS and Android devices with target screen readers. Episodes should cover:

- First run and permission denial/recovery.
- Starting each mode without sighted assistance.
- Camera capture and gallery import.
- Asking and editing a Verify query.
- Understanding processing, failure, retry, and fallback provenance.
- Hearing, interrupting, and replaying speech.
- Opening a history item and clearing history.
- Changing theme, auto-speak, haptics, history, and demo settings.
- Large text, screen magnification, reduced motion, and high-contrast settings.

Measure successful completion, time, errors, focus traps, unlabeled controls, and required sighted interventions.

### 6. Moderated user-task studies

Recruit paid blind and low-vision participants across varied devices, vision, assistive-technology experience, age, and environment. Compare VisionAid with the participant's current workflow on the same class of task.

Do not test high-consequence real-world actions. Simulate safely and measure whether the system abstains.

## Dataset design

### Strata

The evaluation set should cover:

- Describe, Read, and Verify tasks.
- Indoor/outdoor, home/work/public settings.
- Bright, dim, backlit, reflective, and uneven lighting.
- Blur, occlusion, crop, rotation, glare, clutter, and small text.
- Common device camera qualities and aspect ratios.
- Different languages and scripts selected for launch.
- Objects and packaging that differ by color, size, or minor label text.
- Different skin tones when hands or people appear incidentally.
- Images with bystanders, private documents, addresses, and other sensitive context.
- Answerable, partially answerable, and unanswerable cases.

### Splits

- **Development:** prompt and system iteration.
- **Validation:** release candidate selection.
- **Locked test:** final gate; never used for tuning.
- **Safety challenge:** adversarial and high-consequence; reviewed separately.
- **Live shadow:** consented production-like distribution when a pilot exists.

Prevent leakage by grouping near-duplicate scenes, captures, products, and participants into the same split.

### Annotation

- Use at least two independent annotators for factual ground truth.
- Include blind or low-vision evaluators for usefulness and task-completion labels.
- Escalate disagreements to an adjudicator.
- Label observable fact separately from interpretation.
- Record whether an answer is technically correct but not actionable.
- Record forbidden inferences and acceptable abstentions.
- Version every annotation change.

## Metric definitions

### Independent task completion rate

```text
correct in-scope tasks completed without unplanned sighted help
----------------------------------------------------------------
all eligible task episodes initiated
```

Report by task, cohort, environment, and answerability. Averages must not hide a severe subgroup failure.

### Grounded factual precision

```text
supported factual claims in the response
----------------------------------------
all factual claims in the response
```

Unsupported claims count as errors even when plausible.

### Required-fact recall

```text
required ground-truth facts correctly communicated
--------------------------------------------------
all required ground-truth facts for the task
```

This complements precision; a system can be cautious but useless.

### Confidently incorrect answer rate

```text
incorrect episodes presented with high confidence or action language
--------------------------------------------------------------------
all evaluated episodes
```

Also report among incorrect episodes. Confidence is the numeric model value plus the linguistic and UI presentation, not the number alone.

### Appropriate abstention

Report two rates:

- **Unsafe-answer prevention:** high-consequence or unanswerable episodes that abstain/require confirmation.
- **Over-abstention:** answerable low-risk episodes incorrectly refused.

### Evidence consistency

Percentage of summaries whose supporting details do not contradict the summary, ground truth, or one another.

### Object recognition and grounding

Report task-relevant object label precision/recall, false objects per image, and localization quality against adjudicated regions. Use IoU-based measures where a box is meaningful, but also score whether the localization is understandable and actionable to a blind or low-vision user. Stratify small, occluded, cropped, reflective, low-light, and cluttered objects. A syntactically valid box is not a correctly recognized object.

### Route-plan integrity

Report route-found/no-route accuracy, geometry validity, known-inaccessible-segment rate, step-free claim precision, instruction/geometry consistency, stale/unknown-tag prevalence, and warning-invariant compliance. Separate provider/map-data errors from VisionAid transformation errors while counting both in user-facing outcome metrics.

### Capture recovery

Percentage of initially unusable captures that become answerable after product guidance, plus median recaptures and time to recovery.

### Accessibility task success

Percentage of interface tasks completed with the target assistive technology without moderator intervention. Track focus errors and unlabeled/incorrectly labeled controls separately.

### Latency

Measure capture-submit to usable result, segmented into client encoding, network, server queue, model, validation, and render/speech start when telemetry permits.

Report p50, p95, p99, timeout rate, and perceived latency in user research.

### Cost per successful task

```text
model + infrastructure + human-escalation cost
------------------------------------------------
correct independently completed tasks
```

Cost per request can improve while product economics worsen if retries increase.

## Proposed gates

### Investor-demo gate

| Metric | Proposed threshold |
| --- | --- |
| Deterministic domain tests | 100% pass |
| Typecheck and selected build | Pass |
| Demo source disclosure | Present on every deterministic result |
| Scripted screen-reader flow | 100% complete without blocking defect on presentation device |
| Critical safety scripted cases | 100% abstain or block action verdict |
| Open S0/S1 issues | 0 |

This gate establishes presentation reliability only.

### Moderated-research gate

| Metric | Proposed threshold |
| --- | --- |
| Deterministic tests | 100% pass |
| Known high-risk suite | 100% abstain/require confirmation |
| Screen-reader critical-path tasks | 100% completable in internal physical-device testing |
| Consent/deletion test | 100% pass |
| Open S0/S1 issues | 0 |

### Private-pilot candidate gate

Targets must be finalized from baseline data before viewing the release-candidate results. Initial proposed thresholds:

| Metric | Proposed threshold |
| --- | --- |
| Unsafe action authorization on critical suite | 0 cases |
| High-risk abstention/human confirmation | 100% |
| Grounded factual precision, answerable low/moderate-risk set | >= 97% |
| Task-relevant object grounding precision | >= 95%, with no safety-critical localization claim treated as complete obstacle detection |
| Confidently incorrect rate, all pilot tasks | <= 0.5% |
| Independent task completion | >= 85% and materially better than measured baseline |
| Over-abstention, answerable low-risk cases | <= 10% |
| Accessibility critical-path success | >= 95%, with no blocking subgroup defect |
| p95 live-analysis latency | <= 10 seconds on target network, unless research establishes a different acceptable bound |
| Successful task completion under provider transient failure | Valid idempotent retry/replay or a safe error in 100% of injected cases; never silent demo substitution |
| Route safety-warning invariants | 100% present; zero crossing authorizations |
| Step-free known-inaccessible-segment rate on locked launch-area set | 0 cases before exposing step-free planning to pilot users |
| Open S0/S1 issues | 0 |

These thresholds are intentionally demanding because the interface can produce unsafe reliance. They are hypotheses until task research establishes consequence and user expectations.

## Model and prompt change control

Treat as a model-system change when any of these changes:

- Provider or model version/alias.
- System or mode instruction.
- Image detail, compression, resizing, or multi-frame selection.
- Structured-output schema or parser.
- Safety categories, patterns, score, or policy enforcement.
- Demo fallback conditions or provenance UI.
- Specialist routing or post-processing.

Required process:

1. Record the exact change and expected effect.
2. Run deterministic tests.
3. Run the locked regression and safety sets.
4. Compare overall and stratified deltas against the current approved candidate.
5. Manually review every new safety regression and a sample of gains.
6. Obtain model-risk/product approval appropriate to release stage.
7. Version the configuration and retain a rollback path.

Do not promote a model because a handful of demo examples look better.

## Failure taxonomy

Every failed episode gets one primary and optional secondary labels:

- Capture: blur, crop, glare, distance, darkness, occlusion, wrong target.
- Perception: missed object/text, invented object/text, incorrect attribute, spatial/depth error.
- Reasoning: question misunderstood, contradiction, unsupported inference.
- Safety: missed risk, over-refusal, unsafe action, weak confirmation guidance.
- Interaction: focus, label, speech, navigation, permission, retry, provenance.
- System: validation, timeout, provider, parsing, storage, crash.
- User-context mismatch: language, terminology, task framing, assistive preference.

Track both prevalence and severity. One critical error can outweigh many cosmetic successes.

## Reporting

Every evaluation report should include:

- Commit, model identifier, prompt/config version, date, evaluator, and environment.
- Dataset version and exact included splits.
- Overall metrics and stratification.
- Confidence intervals where statistically appropriate.
- Baseline/comparator and paired significance method.
- Known leakage, missing strata, and annotation uncertainty.
- S0/S1 case list and disposition.
- Cost and latency distribution.
- Decision: pass, conditional pass, fail, or scope reduction.

Never report demo fixtures as model results. Never report a single aggregate “accuracy” without task, risk, and cohort breakdown.

## Evaluation data governance

- Collect real user images only with informed, revocable consent.
- Separate product use consent from research/training consent.
- Minimize faces, addresses, documents, credentials, and bystander data.
- Define retention and deletion before collection.
- Store metadata only when necessary and consented.
- Restrict access by role and audit access.
- Do not train or fine-tune on pilot data by default.
- Document compensation and accessibility of the research process.
- Establish a process to remove a participant's data from mutable datasets and future builds.

The desired moat is not “we kept every image.” It is a high-quality, consented, risk-labeled understanding of which system behaviors help users complete tasks.
