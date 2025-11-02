# Research: Background Session Guard

## Decisions

- Delta-only CONTROL already enforced; keep history read-only in system.  
- Timebox = 4:00 from first background question; transition gracefully after AI/user turn completion.  
- Zero-run limit = 2 consecutive 0/0/0 per project; projects cap = 2; after either, proceed to coding unless stopCheck hit earlier.  
- No unprompted coding: explicit prompt constraint in system messages; UI/SM enforces transitions.

## Rationale

- Prevents model autonomy from steering session; aligns with deterministic flow.  
- Time cap avoids stalls; “graceful” ensures UX continuity.  
- Two‑zero rule detects lack of new evidence without punishing silence.

## Alternatives Considered

- Heavier dialogue policy frameworks: overkill; single prompt constraint suffices.  
- Streaming interruption at 4:00: rejected (disruptive); wait for `response.done` or end‑of‑speech.
