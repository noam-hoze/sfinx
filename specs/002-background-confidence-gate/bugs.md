# Bugs - Background Confidence Gate (OpenAI path)

## 1) CONTROL backchannel not reliably returned
- Repro: Background Q&A → user answers → check console.
- Expected: Text‑only CONTROL JSON within 5s after each user background answer.
- Actual: Frequent `[control] timeout: no CONTROL received within 5s`; occasional success (e.g., overallConfidence 0.7) then silence.
- Suspected cause: Realtime `response.create` not honoring text‑only CONTROL request consistently; event gating allows only one permitted reply.
- Suggested fix: Tag control requests with a unique turn id in system text and accept only the next text `response.done`; consider using a second lightweight session/channel for CONTROL.

## 2) CONTROL content leaked into spoken output (policy violation)
- Repro: Rare; AI uttered confidence details verbally.
- Expected: No rubric/confidence spoken.
- Actual: Confidence mentioned in speech.
- Suggested fix: Keep spoken prompts free of CONTROL instructions; continue logging `[policy] CONTROL leaked…` and refine follow‑up prompts (“do not mention confidence”).

## 3) Unauthorized jump to coding stage
- Repro: Background Q&A without CONTROL ≥95% and ≥3 answers; logs show `in_coding_session` and AI proposes coding.
- Expected: Advance to coding only when gate satisfied.
- Actual: State machine/agent transitions to coding on its own.
- Suspected cause: Legacy interview machine slice/flow still transitions on background_answered_by_user; prompt encourages transition wording.
- Suggested fix: Enforce a hard client guard: ignore “move to coding” unless gate satisfied; adjust slice to defer coding state until external gate fires.

## 4) Conversation stalls when CONTROL missing (earlier build)
- Repro: Missing CONTROL caused no further replies.
- Status: Addressed by decoupling; conversation now continues.
- Follow‑up: Keep this invariant in future edits.


## 5) Timing of CONTROL trigger
- Repro: CONTROL was requested during greeting/first AI Q.
- Expected: Start CONTROL only after the first user answer to the initial background question.
- Status: Corrected; keep guard.

## 6) Script mapping bug
- Repro: Coding prompt fetched from `codingPrompt`/`codingAnswer`.
- Actual: Script uses `codingChallenge.prompt/answer`.
- Status: Fixed; validate across all company/role scripts.

---

## Immediate priorities
(2)
(1)