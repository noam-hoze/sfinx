# Evidence Clip Timing Architecture

## Overview

Evidence clips are timestamped links into the interview video, calculated as:

```
videoOffset = (eventTimestamp - recordingStartedAt) / 1000
```

`recordingStartedAt` (wall-clock `Date`) is stored on `InterviewSession` in the DB.
Each event type captures its own timestamp at the moment the event occurs.

## External Tool Usage (Paste Evaluation)

**Single owner**: `OpenAITextConversation.tsx`

- `aiQuestionTimestampRef` (local `useRef`) is set to `Date.now()` immediately before `post(initialQuestion)` — the moment the AI follow-up question appears in chat.
- The ref is used directly in both the normal save path (evaluation completes) and `flushPendingPasteEval()` (interview concludes early or a second paste arrives).
- `InterviewIDE.handleInterviewConcluded` delegates to `flushPendingPasteEval()` via `useImperativeHandle`; it no longer contains any save logic.
- Redux `codingSlice` no longer stores `aiQuestionTimestamp`.

### Race condition guards

| Guard | Mechanism |
|-------|-----------|
| Double-save | `savedToDbRef` checked before every POST |
| Concurrent POST | `savingRef` mutex prevents overlapping requests |
| Second paste overwrites first | `handlePasteDetected` calls `flushPendingPasteEval()` before resetting refs |

## Background Evidence

Captured in `QuestionCard.tsx` via `questionReadyTimeRef` when audio playback begins.
Offset computed in `background-summary/route.ts`.

## Code Contributions (Iterations)

Captured in `evaluate-code-change/route.ts` using `Date.now()` at evaluation time.
Offset computed in `iterations/route.ts`.

## recordingStartedAt Reliability

- **Normal sessions**: set during `createInterviewSession` call in `page.tsx`.
- **Warmup sessions**: `page.tsx` awaits a PATCH to `update-recording-start` after `startRecording()` succeeds, before the interview proceeds.
- **Dev mode** (`skipScreenShare`): `actualRecordingStartTimeRef` is set to `new Date()` in `useScreenRecording.ts`.

## Multi-Session Support

`warmup/activate` creates a **new** `InterviewSession` (with fresh `TelemetryData`, `WorkstyleMetrics`, `GapAnalysis`) when a non-WARMUP application already exists for the same candidate+job. The warmup shell application is deleted; the new session is attached to the existing application. Each interview attempt gets its own session, video upload, and evidence records.

## Session Cleanup on Recording Restart

`update-recording-start` runs a `prisma.$transaction` that wipes all stale child records before setting `recordingStartedAt`:

- Deletes: `CategoryContribution`, `ExternalToolUsage`, `Iteration`, `ConversationMessage`, `EvidenceClip`, `BackgroundEvidence`, `VideoChapter`, `BackgroundSummary`, `CodingSummary`, `Gap`
- Resets: `TelemetryData` scores/flags to zero, `WorkstyleMetrics` usage fields to `null`
- Clears: `InterviewSession.videoUrl` set to `null`

This ensures no stale data from a previous recording attempt contaminates the new one.

## No Silent Offset Clamps

`Math.max(0, ...)` has been removed from all video offset calculations in: `evaluate-code-change`, `background-summary`, `background-chapters`, `coding-summary-update`, `iterations`, `paste-chapter`. Negative offsets now surface as visible bugs (pointing to a `recordingStartedAt` timing issue) rather than being silently masked to `0:00`.

## Debug Verification

When `NEXT_PUBLIC_DEBUG_MODE=true`, a red "REC MM:SS" badge appears in the header.
Note the timer value when the AI question appears, then compare with the CPS evidence link timestamp — they should match within ~1 second.

## Known Limitations

- When a candidate answers "I don't know" to a second follow-up question during external tool usage evaluation, no evidence clip is created for that answer. Tracked for future fix.
