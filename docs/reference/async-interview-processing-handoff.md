# Async Interview Processing — Agent Handoff Notes

**Branch:** `claude/async-interview-processing-cFEcA`
**Date:** 2026-02-21
**Author:** Claude (claude-sonnet-4-6)

---

## What Was Changed and Why

This branch introduces a series of fixes and one significant architectural change to the post-interview flow. Below is a precise record of every change made, the problem it solves, and any caveats the next agent should know.

---

## 1. Bug Fix: Infinite Spinner on CPS Page

**Problem:** The Company Profile Screen (CPS, `/app/(features)/company/...`) could get stuck showing a spinner forever if the post-interview AI processing threw an exception, because the spinner was only dismissed inside a `try` block with no `finally`.

**Fix:** Added a `try/finally` block so the spinner is always dismissed regardless of success or failure.

**Files changed:**
- `app/(features)/interview/components/InterviewIDE.tsx` — `handleSubmit` now has proper `try/finally`

---

## 2. Bug Fix: Stale Telemetry Cache Poisoning `videoUrl`

**Problem:** The telemetry API (`/app/api/telemetry/route.ts`) caches its response in Redis/memory. The cache was being written as soon as the session became `COMPLETED`, but at that moment `videoUrl` could still be `null` in the DB (the video upload is async). Once cached with `null`, all subsequent requests served the stale response — so the CPS page always showed "No video available" even though the video existed in Vercel Blob.

**Fix:** The telemetry API now skips writing the cache when any session is `COMPLETED` but has no `videoUrl` yet. It will keep querying the DB until `videoUrl` is present, then cache.

**Files changed:**
- `app/api/telemetry/route.ts` — cache write guard now checks `status === "COMPLETED" && !videoUrl`

---

## 3. Bug Fix: Sub-scores Exposed to Candidate / Dual Calculation

**Problem:** The CPS page was re-calculating sub-scores client-side from raw session data (duplicating server logic) and those scores were also accessible to the candidate's browser session.

**Fix:** Scores are now computed only server-side in the telemetry API and returned as a finished result. The client-side calculation `useEffect` was removed from the CPS page.

**Files changed:**
- `app/(features)/company/[companyId]/candidate/[applicationId]/page.tsx` — removed score calculation `useEffect`
- `app/api/telemetry/route.ts` — scores are now computed and returned authoritatively

---

## 4. Bug Fix: XSS in Candidate Story Field

**Problem:** The `story` field returned from the telemetry API was being rendered with `dangerouslySetInnerHTML` without sanitization, allowing a script injection via a malicious AI-generated story string.

**Fix:** The story is now sanitized using the browser-native `DOMParser` before rendering. `dompurify` was considered but rejected to avoid adding a dependency.

**Files changed:**
- `app/(features)/company/[companyId]/candidate/[applicationId]/page.tsx` — DOMParser sanitizer applied to `story`

---

## 5. Architecture: Async Post-Interview Processing

**Problem:** After a candidate submitted their solution, the server ran AI scoring, embedding generation, and evaluation synchronously inside the candidate's API request. This made the candidate wait 30–90 seconds for a response, and any failure during that window could lose the session data.

**Fix:** Introduced a new `/process` endpoint that:
1. Returns `202 Accepted` immediately after marking the session `PROCESSING`
2. Runs all AI work asynchronously using Next.js `after()` (a server-side deferred execution hook)
3. Marks the session `COMPLETED` when done

The candidate's browser fires this endpoint as fire-and-forget and never waits for it.

**Files changed:**
- `app/api/interviews/session/[sessionId]/process/route.ts` — new endpoint (POST, returns 202)
- `app/(features)/interview/components/InterviewIDE.tsx` — `handleSubmit` fires `/process` without awaiting it

**CPS polling added:** The CPS page now polls the telemetry API every 5 seconds while `status === "PROCESSING"` or `status === "COMPLETED"` but `videoUrl` is still null. It shows a spinner during this wait and switches to the full candidate profile once both conditions are met.

**Files changed:**
- `app/(features)/company/[companyId]/candidate/[applicationId]/page.tsx` — polling `useEffect` added

---

## 6. Cleanup: Removed Dead `insertRecordingUrl` Function

**Problem:** There were two functions responsible for uploading the interview recording:
1. `uploadRecordingToServer` — called automatically inside the `MediaRecorder.onstop` event handler. This does the full flow: upload blob to Vercel Blob → PATCH `videoUrl` into the `InterviewSession` DB row.
2. `insertRecordingUrl` — a separate exported function that attempted the same thing. It was called in `InterviewIDE.tsx` immediately after `stopRecording()`.

In practice, `insertRecordingUrl` was always a no-op: by the time it ran, `uploadRecordingToServer` had already completed (because `stopRecording` now awaits it via the `uploadDone` promise), and `recordedChunksRef.current` had been cleared, causing `insertRecordingUrl` to exit at its early-return guard `if (recordedChunksRef.current.length === 0)`.

**Fix:** Removed `insertRecordingUrl` entirely.

**Files changed:**
- `app/(features)/interview/components/hooks/useScreenRecording.ts` — `insertRecordingUrl` function and return value removed
- `app/(features)/interview/components/InterviewRecordingContext.tsx` — `insertRecordingUrl` removed from context type
- `app/(features)/interview/components/InterviewIDE.tsx` — `await insertRecordingUrl()` removed from both `handleSubmit` and the timer-expiry `onExpire` callback; removed from `useCallback` dependency array

---

## Current Recording Upload Flow (After All Changes)

```
candidate clicks Submit (or timer expires)
  → handleSubmit() in InterviewIDE.tsx
      → updateSubmission(code)
      → await stopRecording()
            → mediaRecorder.stop()
            → awaits uploadDone promise
            → onstop fires:
                → creates Blob from chunks
                → await uploadRecordingToServer(blob)
                    → upload() to Vercel Blob → gets URL
                    → PATCH /api/interviews/session/:id  { videoUrl }
                    → setRecordingUploaded(true)
                → uploadDone resolves  ← stopRecording() returns here
      → fire-and-forget POST /api/interviews/session/:id/process
            → server marks session PROCESSING (202 returned immediately)
            → after(): runs AI scoring/embedding → marks COMPLETED
      → sayClosingLine()
      → setCodingStarted(false)
```

**Key guarantee:** `videoUrl` is in the DB **before** `/process` is fired. This prevents the race condition where the session becomes `COMPLETED` with a null `videoUrl`.

---

## Known Open Questions / Next Steps

1. **Verify `videoUrl` actually reaches the DB in production.** The architecture is correct but the fix hasn't been validated end-to-end in a live interview. Check server logs for `[Session PATCH] ✅ SUCCESS!` after a real submission.

2. **`after()` availability.** The `/process` endpoint uses Next.js `after()`. This requires Next.js 15+ and is a canary feature as of early 2026 — verify it is stable on the deployed runtime.

3. **CPS polling interval.** Currently polls every 5 seconds. If AI processing typically takes longer, consider increasing this or adding a WebSocket/SSE notification instead of polling.

4. **`uploadRecordingToServer` still uses stale closure for `recordingUploaded`.** The function captures `recordingUploaded` from the render closure rather than a ref, so if it is called when `recordingUploaded` is `true` in state it will skip. This is intentional as a deduplication guard, but it means the guard relies on React render timing. A ref-based guard would be more reliable if double-upload issues are ever observed.
