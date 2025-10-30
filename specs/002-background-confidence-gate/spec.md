# Feature Specification: Background Confidence Gate

**Feature Branch**: `[001-background-confidence-gate]`  
**Created**: 2025-10-28  
**Status**: Draft  
**Input**: User description: "Humanized background stage where AI self-determines sufficiency using confidence; evaluates adaptability, creativity, reasoning; uses curveballs; show stage+confidence in DEBUG_MODE; auto-advance at ≥95%."

## Interview Structure (authoritative)

1. Stage 1: Greeting — interviewer greets and confirms readiness.
2. Stage 2: Background Q&A — learn a concrete project; tailored follow‑ups + curveballs; evaluate adaptability/creativity/reasoning; continue until sufficient; internal 95% gate advances; ask ≥3 questions before advancing.
3. Stage 3: Coding Task — present task; candidate codes; interviewer stays neutral unless asked.
4. Stage 4: Submission — candidate submits; no review phase.
5. Stage 5: Wrap‑up — neutral closing and end session.

## User Scenarios & Testing (mandatory)

### User Story 1 - AI gathers and evaluates background (Priority: P1)

The AI interviewer conducts background Q&A tailored to the candidate’s experience, selects three evaluation pillars (adaptability, creativity, reasoning), asks dynamic follow-ups including curveballs, and maintains a running confidence score of sufficiency for the background stage.

**Why this priority**: Core value—determines readiness to progress using evidence-based confidence.

**Independent Test**: Run a scripted session; verify confidence updates after each answer and that scoring references evidence.

**Acceptance Scenarios**:

1. Given a candidate answer, When the AI emits a hidden control line with JSON confidence, Then the app parses it and updates the background confidence state.
2. Given insufficient confidence after ≥3 questions, When another relevant question is asked, Then confidence updates again without advancing.
3. Given the updated interviewer prompt, When asking questions, Then it uses curveballs and follow‑ups tailored to experience, avoids exposing rubric/confidence, and uses a neutral readiness phrase only when sufficient.

---

### User Story 2 - Auto-advance at threshold (Priority: P2)

When confidence reaches or exceeds 95%, the system ends the background stage and proceeds to the next stage without additional prompting.

**Why this priority**: Prevents over-questioning and keeps interview natural.

**Independent Test**: Seed confidence to 94% then 95%; verify transition only occurs at ≥95%.

**Acceptance Scenarios**:

1. Given confidence at 94%, When the next answer arrives, Then the system remains in background stage.
2. Given confidence at 95% or higher, When evaluation completes, Then the system transitions to the next stage exactly once and sets stage="coding".

---

### User Story 3 - Debug visibility (Priority: P3)

If DEBUG_MODE is true, the system displays current stage and current confidence percentage each turn; otherwise this remains hidden from the candidate.

**Why this priority**: Enables internal monitoring without impacting candidate experience.

**Independent Test**: Toggle DEBUG_MODE and verify visibility state matches.

**Acceptance Scenarios**:

1. Given DEBUG_MODE=true, When any turn completes, Then stage name and confidence are visible to staff.
2. Given DEBUG_MODE=false, When any turn completes, Then no debug indicators are shown to the candidate.

---

### Edge Cases

- Candidate gives vague/irrelevant answers: confidence should not increase materially; AI asks clarifying questions.
- Confidence oscillates around 95%: advance only once when first reaching ≥95%.
- DEBUG_MODE unset or malformed: default to hidden.

## Requirements (mandatory)

### Functional Requirements

- **FR-001**: System MUST evaluate along exactly three pillars: adaptability to change, creativity, ability to reason.
- **FR-002**: System MUST generate tailored follow-up and curveball questions based on candidate responses.
- **FR-003**: System MUST maintain a confidence score (0–100%) representing sufficiency to complete the background stage.
- **FR-004**: System MUST automatically advance to the next stage when confidence ≥ 95% and not before.
- **FR-005**: System MUST display current stage and confidence each turn only when DEBUG_MODE=true; otherwise it MUST remain hidden.
- **FR-006**: System MUST associate confidence changes with evidence (answer snippets) and affected pillars in debug output.
- **FR-007**: System MUST ask at least 3 background questions before making an advance decision.
- **FR-008**: System MUST record the moment of stage transition and the final confidence value.
- **FR-009 (Prompt Alignment)**: The interviewer prompt MUST: (a) target adaptability, creativity, reasoning; (b) use curveballs tailored to experience; (c) ask follow‑ups until sufficient evidence; (d) avoid revealing rubric or confidence; (e) use a neutral readiness phrase when sufficient.
- **FR-010 (Stage Controller)**: The flow controller MUST encode the 5 stages (Greeting → Background → Coding → Submission → Wrap‑up) and expose deterministic transitions.
- **FR-011 (Evaluation via Chat Completions - OpenAI)**: After each candidate answer, the system MAY request an evaluation via the OpenAI Chat Completions API (out-of-band from Realtime speech). The request MUST include the last K alternating turns (const `CONTROL_CONTEXT_TURNS`, default 10) and a system instruction to assess sufficiency to score the background stage across the three pillars. The model MUST return STRICT JSON using a schema: `{overallConfidence:number (0–100), pillars:{adaptability:number, creativity:number, reasoning:number}, readyToProceed:boolean}`.
- **FR-012 (Updater - App)**: The app MUST parse the JSON result, update confidence in state, enforce ≥3 background questions, and advance to Coding only when `overallConfidence ≥ 95` and `readyToProceed=true`. Requests are serialized (max 1 in-flight per user answer). Results are never hidden or discarded; anomalies MUST be logged.

### Key Entities (data-level, conceptual)

- **BackgroundAssessment**: pillars [adaptability, creativity, reasoning]; per-pillar rationale; overall confidence; evidence references; source=OpenAI control line.
- **InterviewStageState**: stage name, status, current confidence, debug visibility flag, transition timestamp.

## Success Criteria (mandatory)

### Measurable Outcomes

- **SC-001**: 100% of transitions occur only at confidence ≥95% and `readyToProceed=true` from Chat Completions evaluation.
- **SC-002**: With DEBUG_MODE=true, stage and confidence appear on 100% of turns.
- **SC-003**: Average of ≤8 background questions before reaching decision in pilot runs.
- **SC-004**: ≥80% reviewer rating that follow-ups/curveballs are relevant and evidence-backed.

## Assumptions

- The three pillars are fixed (adaptability, creativity, reasoning) for this stage.
- No hard maximum number of background questions; product may tune later.
- DEBUG_MODE is a runtime configuration accessible during the session.
 - CONTROL evaluation is non-spoken (Chat Completions), so prompt does not need leakage guards.
 - Realtime remains responsible for speech; evaluation is out-of-band and does not consume the audio turn.

## Implementation Notes (plan)

- Client builds the evaluation context from the last `min(userTurns, aiTurns, CONTROL_CONTEXT_TURNS)` alternating messages and adds a concise system instruction focused on “sufficiency to score background,” not “best candidate”.
- Use `response_format: json_schema` (strict), temperature 0, 10–20s timeout.
- Add a per-request `turnId` for logs; do not auto-suppress late results—log and surface for debugging.
- Initially exposed via a manual “Request CONTROL (Chat)” button; later, trigger once automatically after each user-final in Background.
