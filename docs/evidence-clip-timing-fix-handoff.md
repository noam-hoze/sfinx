# Evidence Clip Timing Fix — Handoff Document

## Branch
`claude/fix-evidence-clip-timing-Gohil`

## Problem

Evidence clips (video links showing paste detection events during interviews) were pointing to incorrect timestamps in the recording. The `aiQuestionTimestamp` field — used to calculate the video offset for evidence clips — was being set to the **paste detection time** instead of the **time the AI question was actually posted to the chat**.

Between paste detection and the AI question appearing on screen, several async operations run:
1. Topic identification API call (`/api/interviews/identify-paste-topics`)
2. Potentially a fallback question generation via `askViaChatCompletion`

These can take **several seconds**, causing evidence clips to jump to a point in the video before the AI question was visible.

## Root Cause

In `OpenAITextConversation.tsx`, inside `handlePasteDetected`:

```ts
// OLD (bug): used paste detection timestamp
const aiQuestionTimestamp = timestamp;
```

The `timestamp` parameter is `Date.now()` captured in `EditorPanel.tsx` at the moment the paste event fires — before any async work begins.

Additionally, in `InterviewIDE.tsx`, the fallback when `aiQuestionTimestamp` was missing used `Date.now()` at interview conclusion time (potentially 20+ minutes after the paste), which was even worse:

```ts
// OLD (bug): fallback to current time at interview conclusion
aiQuestionTimestamp: activePasteEval.aiQuestionTimestamp || Date.now(),
```

## Fix (3 files changed)

### 1. `app/(features)/interview/components/chat/OpenAITextConversation.tsx` (line ~305)

Changed `aiQuestionTimestamp` from `timestamp` (paste detection time) to `Date.now()` (when the AI question is actually posted to the chat):

```ts
// NEW (fix): capture time when question is actually posted
const aiQuestionTimestamp = Date.now();
```

### 2. `app/(features)/interview/components/InterviewIDE.tsx` (lines ~349, ~388)

Changed both fallback values from `Date.now()` to `activePasteEval.timestamp` (paste detection time — a reasonable approximation when `aiQuestionTimestamp` is missing):

```ts
// NEW (fix): fall back to paste detection time, not interview conclusion time
aiQuestionTimestamp: activePasteEval.aiQuestionTimestamp || activePasteEval.timestamp,
```

Added a warning log when the fallback is used (line ~347):
```ts
if (!activePasteEval.aiQuestionTimestamp) {
    logger.warn("⚠️ [PASTE_EVAL] aiQuestionTimestamp missing, using paste detection timestamp as fallback");
}
```

### 3. `app/(features)/interview/components/chat/evidenceClipTiming.test.ts` (new file)

Added 9 unit tests covering:
- Video offset calculation (positive, zero, negative offsets)
- Timing accuracy: proves the old behavior gives offsets that are seconds too early
- Fallback logic: ensures missing `aiQuestionTimestamp` falls back to paste detection time, never `Date.now()` at conclusion
- Evidence link filtering: negative offsets should be excluded

## Data Flow (for context)

```
EditorPanel (paste event, Date.now())
  → handlePasteDetected(pastedCode, timestamp)
    → async: identify-paste-topics API
    → async: askViaChatCompletion (fallback)
    → aiQuestionTimestamp = Date.now()  ← FIX: captured here, after async work
    → dispatch(updatePasteVideoMetadata({ aiQuestionTimestamp }))
    → stored in Redux: activePasteEvaluation.aiQuestionTimestamp
      → sent to DB via POST /api/interviews/session/[id]/external-tools
        → stored as ExternalToolUsage.aiQuestionTimestamp (DateTime)
          → read by GET /api/candidates/[id]/telemetry
            → videoOffset = (aiQuestionTimestamp - recordingStartedAt) / 1000
```

## Tests

Run: `pnpm vitest run app/\(features\)/interview/components/chat/evidenceClipTiming.test.ts`

All 9 tests pass. The 3 pre-existing test failures in the repo are unrelated (Prisma client not generated, audio conversion validation, XSS sanitization).

## Status

- Committed: `dc93638`
- Pushed to: `origin/claude/fix-evidence-clip-timing-Gohil`
- Ready for PR creation
