# Research: Background Confidence Gate

## Decisions

- Decision: Use existing OpenAI integration and conversational flow to generate tailored follow-ups and curveballs.
  - Rationale: Reuse-first; existing infra already drives interviewer prompts.
  - Alternatives considered: Custom rule engine only; hybrid rules+LLM. Chosen: hybrid—rules for gating, LLM for content.

- Decision: Confidence source = OpenAI control line (JSON) after each candidate answer.
  - Rationale: Let the model judge sufficiency; app enforces gate deterministically.
  - Alternatives: Local heuristic scorer — rejected per product intent.

- Decision: Confidence threshold fixed at 95% with minimum 3 background questions before advancing.
  - Rationale: Ensures sufficient evidence; prevents premature exits.
  - Alternatives: 90%/98%/adaptive — deferred.

- Decision: Maintain per-pillar values in CONTROL JSON and show in debug only when DEBUG_MODE=true.
  - Rationale: Reviewer transparency; hidden from candidates.

- Decision: In-memory state for POC; no persistence changes.

- Decision: Encode the 5-stage flow in the controller and reflect in the prompt.

## Library Scan (Mandatory)

- Area: Control-line parsing and flow control.
  - Candidates: Existing OpenAI SDK (reuse), internal state store (reuse).
  - Decision: No new libraries.

## Clarifications Resolved

- Unknowns: None.


