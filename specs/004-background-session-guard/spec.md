# Feature Specification: Background Session Guard

**Feature Branch**: `004-background-session-guard`  
**Created**: 2025-11-02  
**Status**: Draft  
**Input**: Prevent agent from initiating coding; enforce delta-only CONTROL scoring; timebox background to 4 minutes; auto-ask for another project when 0/0/0 occurs twice; cap project topics to 2; transition to coding when first of: time limit, project cap, or stopCheck satisfied; show countdown in debug panel.

## User Scenarios & Testing (mandatory)

### User Story 1 - Session guard and timebox (Priority: P1)
As an interviewer, background Q&A is bounded by time and evidence; AI cannot initiate coding unless told.

**Why this priority**: Keeps control deterministic and prevents “free mode”.

**Independent Test**: Run background for 4 minutes with no gate: system transitions to coding at t=4:00 gracefully (no mid‑utterance cut; no AI‑initiated coding).

**Acceptance Scenarios**:
1. Given background < 4:00 and stopCheck=false, Then AI must not offer coding; responses remain in background domain.
2. Given elapsed hits 4:00 during an AI reply, Then do not interrupt; transition immediately after `response.done`, and present our scripted coding question.
3. Given elapsed hits 4:00 while user is speaking, Then wait for end‑of‑speech/finalization; transition right after, with no new background prompt.

---

### User Story 2 - Zero-run and project cap (Priority: P2)
As an interviewer, after two consecutive 0/0/0 evaluations, AI politely asks for another challenging project; total distinct projects ≤ 2.

**Why this priority**: Avoids looping; prompts richer evidence.

**Independent Test**: Simulate two consecutive 0/0/0 → AI asks for another project; after second project or two prompts without new info, proceed to coding if time not already hit.

**Acceptance Scenarios**:
1. Given two consecutive 0/0/0 and projectsUsed<2, Then AI asks: “Would you like to share another challenging project you worked on?”
2. Given projectsUsed=2 OR two consecutive 0/0/0 within a project (after already prompting once), Then proceed to coding unless stopCheck already true earlier.

---

### User Story 3 - Debug timer and guard indicators (Priority: P3)
As a developer, I see countdown, zero-run counter, projectsUsed, and gate status in the debug panel.

**Why this priority**: Observability for testing and demos.

**Independent Test**: Timer starts at 4:00 on first background question; counters update on each CONTROL; UI shows guard reason upon transition.

**Acceptance Scenarios**:
1. Given background running, Then panel displays t=mm:ss, zeroRuns, projectsUsed, stopCheck=true/false, last pillars and confidences.
2. Upon transition, panel shows reason = {"timebox"|"projects_cap"|"gate"}.

### Edge Cases
- Candidate silent: no CONTROL calls are made; zeroRuns unchanged; timebox alone triggers coding at 4:00 (gracefully, as above).
- Rapid short answers: debounced CONTROL still enforces delta-only (last answer only).
- Overlapping triggers: if multiple criteria met simultaneously, pick reason by priority: timebox > projects_cap > gate (record all that apply).
- Clock skew/reload: timer persists from first background question timestamp.

## Requirements (mandatory)

### Functional Requirements
- **FR-001**: Prompt constraint: model must not initiate coding or propose tasks; only background Q&A unless explicitly instructed by the app.
- **FR-002**: Timebox: background session hard‑limit 4:00 from first background question; on expiry, transition to coding and present scripted coding question.
- **FR-003**: Zero‑run rule: track consecutive 0/0/0 results per project; after 2 consecutive zeros, ask for another project (once); total projects per interview ≤ 2.
- **FR-004**: Transition criteria: move to coding on the first of {timebox expired, projectsUsed ≥ 2, stopCheck==true}; record reason.
- **FR-005**: Debug panel shows countdown (mm:ss), zeroRuns, projectsUsed, per‑trait conf_T and τ, latest pillars and rationales, and gate reason when applicable.
- **FR-006**: Logs include timestamp, lastQ,lastA, pillars, w per trait, conf_T, zeroRuns, projectsUsed, elapsed, and transition reason.
- **FR-007**: Defaults configurable via constants: TIMEBOX_MS=240000, ZERO_RUN_LIMIT=2, PROJECT_CAP=2.

### Key Entities
- **GuardState**: `{ startedAtMs, elapsedMs, zeroRuns, projectsUsed, reason? }`.
- **LastTurn**: `{ lastQuestion, lastAnswer }` (for delta-only scoring prompts).

## Success Criteria (mandatory)

### Test Cases (must all pass)
1. Timebox‑During‑AI: Given stopCheck=false and background running, When t hits 4:00 mid‑AI reply, Then no interruption occurs, and within 1s of `response.done` the system switches to coding and shows our scripted coding question; no assistant coding invites appear beforehand.
2. Timebox‑During‑User: Given stopCheck=false, When t hits 4:00 during user speech, Then wait for end‑of‑speech; switch to coding within 1s thereafter; no new background prompt is sent.
3. No‑Unprompted‑Coding: Across 100 sessions without explicit command, assert zero assistant messages that solicit coding prior to the state switch to coding.
4. Zero‑Run Prompt: Within a project, two consecutive CONTROL results of 0/0/0 cause the very next AI turn to ask for another challenging project (if projectsUsed<2).
5. Project Cap: After projectsUsed reaches 2, or after two consecutive 0/0/0 following an earlier project prompt, the next state change is coding unless stopCheck==true earlier; record reason as `projects_cap`.
6. Timebox Accuracy: In 95% of runs where gate not met earlier, the coding transition occurs at t≤4:01 from first background question (measured on the client timeline).
