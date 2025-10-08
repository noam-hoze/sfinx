## Interview Flow Spec

### Purpose

Single source of truth for the end-to-end interview behavior across UI, state machine, and ElevenLabs.

### Flow

| Step | Candidate (Human)                 | Carrie (AI interviewer)                                  | Trigger                                  | KB_UPDATE (example)                                                                                      | Hidden userMessage                     | Result                                              | Guards                           |
| ---- | --------------------------------- | -------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------- | -------------------------------- |
| 1    | —                                 | Greet as “Carrie”; ask readiness                         | Connect established                      | {"candidate_name": "<name>",<br>"is_coding": false,<br>"using_ai": false,<br>"current_code_summary": ""} | —                                      | Wait for candidate                                  | —                                |
| 2    | Responds (ready)                  | Acknowledge; present role                                | User speech (ready)                      | —                                                                                                        | —                                      | Move to background Q&A                              | —                                |
| 3    | Answers briefly                   | Ask 1 background question; reactive follow-ups           | Prior answer                             | —                                                                                                        | —                                      | Background established                              | —                                |
| 4    | —                                 | Announce task once; unlock editor; start timer           | App sends KB_UPDATE                      | {"is_in_coding_question": true,<br>"is_coding": true}                                                    | —                                      | Coding begins                                       | —                                |
| 5    | Asks coding questions as needed   | Answer concisely; otherwise silent (reactive-only)       | User speech during coding                | Stream {"current_code_summary": "..."} while connected                                                   | —                                      | Ongoing coding                                      | throttle summaries (~1.5s)       |
| 6    | Pastes large chunk (AI usage)     | Ask exactly one about the added code; then go silent     | Paste burst (≥80 chars or ≥2 newlines)   | {"using_ai": true}<br>→ reset: {"using_ai": false}                                                       | “Ask one about: <ai_added_code>”       | One question; revert to reactive-only               | rising edge guard on using_ai    |
| 7    | Clicks “I’m Done” after new edits | Ask exactly one about the provided delta; then go silent | Button click (with new edits since last) | {"followup_ready": true}<br>→ reset: {"followup_ready": false}                                           | “Ask one about: <followup_delta>”      | One question; revert to reactive-only; button locks | button locks until new edits     |
| 8    | Presses Submit or timer expires   | Say single closing line; disconnect once                 | Submit click or timer expiry             | `{"current_code_summary":"...","is_coding":false}`                                                       | COMPLETION: “Say closing line and end” | Single closing; end and disconnect                  | doneMessageSentRef; concludedRef |

### Communication Architecture

-   Scope of this spec: AI interviewer = ElevenLabs, candidate = human (voice). The UI/editorial pieces are listed for context but are not central.

-   Orchestration (UI shell)

    -   `app/(features)/interview/components/InterviewIDE.tsx` — mounts editor + right panel and wires state machine/KB.
    -   `app/(features)/interview/components/RightPanel.tsx` — hosts conversation adapters and routes events.

-   Conversation engine

    -   ElevenLabs (interviewer):
        -   Adapter: `app/(features)/interview/components/chat/RealTimeConversation.tsx`
        -   Transport: `app/(features)/interview/components/chat/hooks/useMicSession.ts`, `.../hooks/useTransportAdapter.ts`
        -   Role rules: `app/(features)/interview/components/chat/useConversationRoleBehavior.ts`

-   State machine & Knowledge Base (interviewer)

    -   `app/shared/hooks/useElevenLabsAsInterviewer.ts` — owns KB vars, emits KB_UPDATE, sends hidden user messages (nudge/follow-up/completion).
    -   Contexts: `app/shared/contexts` (`InterviewProvider`, `useInterview`).

-   Client tools (exposed to agent sessions)

    -   `app/(features)/interview/components/chat/clientTools.ts` — `buildClientTools`/`registerClientTools` (e.g., open_file/write_file), used by adapters.

-   Recording & telemetry

    -   `app/shared/services/recordings.ts` — audio/code snapshots/transcripts API.
    -   `app/shared/services/logger.ts` — namespaced client logging.

-   Editorial UI (supporting)
    -   `app/(features)/interview/components/editor/EditorPanel.tsx`, `InterviewOverlay.tsx`, `HeaderControls.tsx`, `CameraPreview.tsx`.
