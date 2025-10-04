# Interview Recordings (Noam vs AI Candidates)

## Purpose

Capture how **Noam** (interviewer) reacts — tone, phrasing, timing, and decision flow — across multiple AI candidate tiers (2.5/5/7/9).
Candidate is synthetic (text-only). We record **Noam's behavior** (primary) and **code state** for context.

## Structure

/recordings/{session_id}/

-   metadata.json # session config + candidate tier knobs
-   transcript.jsonl # utterance-level, timestamped
-   code/ # atomic code-step events + final snapshot
-   audio_interviewer.wav # optional
-   logs/integrity.json # seed/temperature/persona hashes

## Generate a new session

```bash
# npx tsx scripts/new_session.ts <YYYY-MM-DDTHH-mmZ> <tier> <task_id> [--with-audio]
npx tsx scripts/new_session.ts 2025-10-04T14-00Z 7 frontend_user_list_component
```

## Tiers → default behavior knobs

-   2.5/10 → temp 0.65, seed 1025, error_rate 0.40
-   5/10 → temp 0.50, seed 1050, error_rate 0.20
-   7/10 → temp 0.40, seed 1070, error_rate 0.10
-   9/10 → temp 0.25, seed 1090, error_rate 0.05

## Validate metadata

```bash
npx ajv -s schema/metadata.schema.json -d recordings/<session_id>/metadata.json
```
