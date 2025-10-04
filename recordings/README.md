# Interview Recordings (Noam vs AI Candidates)

## Purpose

Capture how **Noam** (interviewer) reacts — tone, phrasing, timing, and decision flow — across multiple AI candidate tiers (2.5/5/7/9).
Candidate is synthetic (text-only). We record **Noam's behavior** (primary) and **code state** for context.

## Structure

recordings/{interviewer_id}\_interviewer/{candidate_id}\_candidate/{session_id}/

-   metadata.json # session config + candidate tier knobs
-   transcript.jsonl # utterance-level, timestamped
-   code/snapshots.jsonl # stream of full-code snapshots with timecodes
-   audio_interviewer.webm
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

## Snapshot format

Append one JSON per line to `code/snapshots.jsonl`:

```json
{"ms":0,"ts":"2025-10-04T14:00:00.000Z","content":"<full code>"}
{"ms":4523,"ts":"2025-10-04T14:00:04.523Z","content":"<full code after edit>"}
```

## Server API

-   POST `/api/recordings/start`

    -   Body: `{ "session_id": string, "metadata": any }`
    -   Creates `recordings/{interviewer_id}_interviewer/{candidate_id}_candidate/{session_id}/`, writes `metadata.json`.

-   POST `/api/recordings/audio?session_id=...&interviewer_id=...&candidate_id=...&index=...`

    -   Body: raw audio chunk (e.g., `audio/webm` from `MediaRecorder`).
    -   Appends to `recordings/{interviewer_id}_interviewer/{candidate_id}_candidate/{session_id}/audio_interviewer.webm`.

-   POST `/api/recordings/end?session_id=...&interviewer_id=...&candidate_id=...`

    -   Marks end of session; writes `recordings/{interviewer_id}_interviewer/{candidate_id}_candidate/{session_id}/logs/ended.txt`.

-   POST `/api/recordings/code/snapshot`
    -   Body: `{ "session_id": string, "interviewer_id": string, "candidate_id": string, "ms": number, "ts": string, "content": string }`
    -   Appends one line to `recordings/{interviewer_id}_interviewer/{candidate_id}_candidate/{session_id}/code/snapshots.jsonl`.

## Client usage

-   Helpers: `app/shared/services/recordings.ts`

    ```ts
    import {
        startRecordingSession,
        sendAudioChunk,
        endRecordingSession,
    } from "app/shared/services/recordings";

    // 1) Start
    const session_id = new Date().toISOString().replace(/[:.]/g, "-");
    await startRecordingSession({
        session_id,
        metadata: {
            /* your metadata */
        },
    });
    (window as any).__recordingSessionId = session_id; // enables auto code snapshots

    // 2) Stream audio (MediaRecorder)
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
    let chunkIndex = 0;
    mr.ondataavailable = async (e) => {
        if (e.data && e.data.size)
            await sendAudioChunk(session_id, e.data, chunkIndex++);
    };
    mr.start(1000); // emit chunks every second

    // 3) End
    mr.stop();
    await endRecordingSession(session_id);
    ```

-   Code snapshots
    -   After each successful editor write, the client posts `{ session_id, ms, ts, content }` to `/api/recordings/code/snapshot`.
    -   In this app, `clientTools.write_file` already snapshots automatically when `(window as any).__recordingSessionId` is set.

## Validate metadata

```bash
npx ajv -s schema/metadata.schema.json -d recordings/<session_id>/metadata.json
```
