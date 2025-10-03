## Interview Flow Spec

### Purpose

Single source of truth for the end-to-end interview behavior across UI, state machine, and ElevenLabs.

### Components

-   App shell: `app/interview/components/InterviewIDE.tsx`
-   Conversation bridge: `app/interview/components/chat/RealTimeConversation.tsx`
-   Editor: `app/interview/components/editor/EditorPanel.tsx`
-   State machine: `lib/hooks/useElevenLabsAsInterviewer.ts`

### Canonical KB variables (mirrored to ElevenLabs)

-   `candidate_name: string`
-   `is_coding: boolean`
-   `using_ai: boolean`
-   `current_code_summary: string`
-   `has_submitted: boolean` (internal only; not sent in KB updates any more)

### Startup

1. User clicks “Start Interview”.
2. Screen/mic permissions → create Application → create Interview Session.
3. Start conversation; send initial KB_UPDATE (candidate_name, is_coding=false, using_ai=false, current_code_summary).

### Default Interaction Policy (before coding)

-   is_coding=false
-   Interviewer initiates once on connect: brief greeting and a readiness question.
-   After an affirmative/consent (e.g., “Sure”), deliver the task instructions exactly once.
-   Then remain reactive-only: respond concisely to meaningful user messages (≤2 sentences); do not initiate further.
-   Ignore filler/ellipses/noise; never send closing lines in this phase.

### Start Coding

1. Check NEXT_PUBLIC_AUTOMATIC_MODE
    - if false
      User clicks “Start Coding” → `is_coding=true` (KB_UPDATE).
    - if true
      The agent finishes saying "You can ask me anything you want" → `is_coding=true` (KB_UPDATE).
2. Timer begins (30 minutes). Editor becomes writable.
3. Code summary updates: throttled to ~1.5s; sent while connected.

### Default Interaction Policy During Coding

-   Reactive-only: interviewer is silent unless user speaks meaningfully.
-   Ignore filler/noise.

### AI-Usage Detection + Nudge (one-time per paste burst)

Trigger: Editor detects a single change with either ≥80 characters added OR ≥2 newlines.
Flow:

1. Editor calls `updateKBVariables({ using_ai: true })`.
2. State machine sends KB_UPDATE (includes `using_ai=true`; never includes `ai_added_code`).
3. Immediately sends a hidden user message to ElevenLabs:
    - “You just saw I used an external AI source. please respond to it by asking me about the added code: <ai_added_code>”.
4. Immediately resets to default reactive mode: KB_UPDATE with `using_ai=false`.

### Follow-up Behavior After Nudge

-   ElevenLabs asks exactly one question about the added code (one-time initiation).
-   Immediately after that question, revert to Default Interaction Policy During Coding.
    -   is_coding=true remains; interviewer does not initiate further messages.
    -   Respond only to user-initiated, meaningful messages; ignore filler/noise.
    -   Do not send any closing lines here; closing is driven only by the hidden completion message.

### Submission Completion (manual submit and timer expiry)

1. On submit/timer: stop screen recording; update local submission state.
2. State machine sends KB_UPDATE with `{ current_code_summary, is_coding=false }` (no `has_submitted`).
3. Send a single hidden user message: “I'm done. Please say your closing line and then end the connection.”
4. RealTimeConversation waits for ElevenLabs closing line. When audio finishes, it concludes once and disconnects.

### One-time Guards (prevent duplicates)

-   Hidden completion message: `doneMessageSentRef` in `InterviewIDE.tsx` ensures it is sent once across both paths.
-   Closing handling: `concludedRef` in `RealTimeConversation.tsx` ensures finalization runs once.
-   Submission KB gate: `hasSubmittedOnce` inside state machine prevents resending submission updates (even on retries).

### Reconnection / Dev HMR Resilience

-   Dev hot-reloads may reconnect; latches above prevent duplicate endings and duplicate hidden messages.
-   Conversation cleanup on unmount stops mic tracks and ends session.

### Prompt Alignment (AI_INTERVIEWER_PROMPT.md)

-   During coding: default reactive mode; do not close early.
-   After hidden AI-nudge: ask exactly one question about the added code and return to reactive mode.
-   Closing only after the hidden completion message; never repeat the closing line.

### Logging Notes

-   All KB_UPDATE sends are logged.
-   Detection of the closing line is logged; conclusion is logged exactly once.

### Possible caveats in prompt

At the moment the flow is working.
But if something breaks, check here:

-   Partially aligned: coding phase reactive rules match.
-   Gaps vs spec: task should come only after user affirms readiness; your prompt delivers it immediately.
-   Missing: AI-nudge behavior (ask exactly one question about added code, then revert to reactive).
-   Closing: prompt unconditionally lists the closing line; spec says only after hidden “I’m done” message (never otherwise).
-   Suggest: gate task on readiness, add AI-nudge rule, and condition closing strictly on hidden completion message.
