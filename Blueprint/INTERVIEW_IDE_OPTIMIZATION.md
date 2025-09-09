### InterviewIDE Optimization Plan

This document outlines the current architecture, responsibilities, and a prioritized optimization plan for `app/interview/components/InterviewIDE.tsx` and its collaborating components.

---

## 1) Component Map and Responsibilities

-   **InterviewIDE**

    -   Wraps the app with `InterviewProvider` and renders `InterviewerContent`.

-   **InterviewerContent** (primary orchestrator)

    -   URL/query: reads `companyId`, `jobId`; redirects to `/job-search` if missing.
    -   Auth: gets candidate name from session.
    -   State: UI theme, coding timer, camera, screen recording (MediaRecorder), interview lifecycle, telemetry creation, tabs, code diff display, mic state.
    -   Data: fetches job by `jobId` for logo and context.
    -   Context/Providers: `useInterview`, `useJobApplication` from `lib`; drives code/task state and application status.
    -   Voice/AI: integrates `useElevenLabsStateMachine` for KB variables, transcript handling, coding state, and submission; connects to `RealTimeConversation` via ref for start/stop/messaging.
    -   Editor/Chat: renders `EditorPanel` (code editor, preview, diff controls) and `ChatPanel` (mic mute, transcript area).
    -   Recording: manages screen capture + mic/system audio mix, start/stop, chunk handling, blob creation, upload sequence, and session update.
    -   Interview/session: creates application and interview session, tracks `interviewSessionId`, triggers telemetry creation, completion screen, and navigation.

-   **EditorPanel** (imported)

    -   Props: current code, diff state, tab management, run code, readOnly flag, KB updates.

-   **RealTimeConversation** (imported)

    -   Lifecycle callbacks: onStartConversation/onEndConversation/onInterviewConcluded.
    -   Methods via ref: `startConversation`, `sendUserMessage`, `sendContextualUpdate`, `toggleMicMute`.

-   **ChatPanel** (imported)
    -   Mic mute control and transcript display; listens for `window.postMessage({ type: "clear-chat" })`.

---

## 2) User Flows (Happy Path)

1. Navigate with `companyId` and `jobId` → job fetched → logo displayed.
2. Click "Start Interview" → request screen recording permission → create application → create interview session → start conversation.
3. Click "Start Coding" → timer starts, `setCodingState(true)`, edit code.
4. Submit or timer expires → stop recording → upload file → PATCH session with `videoUrl` → `stateMachineHandleSubmission` → send "I'm done" → show completion screen → navigate back.

---

## 3) Observed Issues and Risks

-   Mixed responsibilities: very large component (1400 lines) coupling UI, recording, networking, timers, theme, camera, and state machine.
-   Redundant upload paths: both `onstop` auto-upload and `insertRecordingUrl` manual upload duplicate logic.
-   Ref + state duplication: `interviewSessionId` and `interviewSessionIdRef` can desync; multiple boolean flags can drift.
-   Excessive logging in production path may affect performance and noise.
-   Timer lifecycle scattering: timer cleared/set in several places; risk of leaks.
-   Camera code embedded in main file; potential memory leaks if not fully cleaned.
-   Theme effects duplicated; can unify.
-   Error handling inconsistent (console.error vs logger, swallowed errors).
-   Tight coupling to `window.postMessage` for chat clearing; implicit contract.
-   MIME fallback logic for MediaRecorder could still produce incompatible output across browsers.

---

## 4) Optimization Goals

-   Reduce component size and responsibilities; isolate concerns.
-   Make recording/upload lifecycle robust and single-sourced.
-   Simplify timer, theme, and camera management.
-   Improve error boundaries and consistent logging.
-   Strengthen contracts between orchestrator and child components.
-   Prepare for testability and future features (additional tasks, preview runtime isolation, resumable uploads).

---

## 5) Proposed Refactors (Incremental, low-risk)

-   Extract hooks:

    -   `useInterviewTimer` (start/stop/reset, formatted time, low-level setInterval handling).
    -   `useThemePreference` (load/save + DOM class management).
    -   `useSelfCameraPreview` (start/stop, refs, fade-out timing, cleanup).
    -   `useScreenRecording` (permission, start/stop, collected blob, selected mime type, auto-upload, and session PATCH) with a single upload pathway.

-   Extract services/utilities:

    -   `interviewSessionService` for POST/PATCH to `/api/interviews/session` endpoints.
    -   `applicationService` for `/api/applications/create`.
    -   `jobService` for `/api/jobs/:id`.
    -   Optional `log` abstraction with levels and dev/prod gating.

-   Normalize state:

    -   Replace dual `interviewSessionId` and `interviewSessionIdRef` with a single source, or a dedicated store in the `useScreenRecording` hook that exposes stable getters.
    -   Consolidate flags: `isInterviewActive`, `isAgentConnected`, `isInterviewLoading` → a simple finite state: idle → starting → active → ending → completed.

-   Remove duplication:

    -   Delete `insertRecordingUrl`; rely on the single `onstop` path from `useScreenRecording` that invokes `uploadAndPatch(sessionId)` when available.

-   Error/edge handling:

    -   Propagate rejections with typed errors; display minimal UI feedback (toasts/banners) where user action is needed.
    -   Guard all `ref.current?.method` calls with clear fallbacks.

-   Contracts with children:
    -   Replace `window.postMessage('clear-chat')` with a prop-driven API or context event.
    -   Define a TypeScript interface for the `RealTimeConversation` ref methods.

---

## 6) Performance Improvements

-   Minimize re-renders:

    -   Memoize callbacks and derived values; move heavy state into hooks to avoid `InterviewerContent` churn.
    -   Use `useMemo` for `companyLogo`.

-   Bundle/UI:

    -   Lazy-load chat and editor subpanels if needed.
    -   Avoid unnecessary `Image` re-layout by predefining sizes.

-   Logging:
    -   Reduce noisy logs in production; leverage environment-based log levels.

---

## 7) Accessibility and UX

-   Provide clear error messages for permission denials.
-   Keyboard focus order for primary actions.
-   Visible timer warnings (already uses color change <5 min).
-   Toggle labels for camera/mic state.

---

## 8) Stepwise Implementation Plan

1. Create hooks: `useThemePreference`, `useInterviewTimer`.
2. Extract `useSelfCameraPreview` and swap in, retain current UI.
3. Build `useScreenRecording` with single upload path and service layer; remove `insertRecordingUrl`.
4. Add `interviewSessionService` and `applicationService`; replace inline fetches.
5. Define `RealTimeConversationHandle` type; type the ref and guard calls.
6. Replace `window.postMessage` chat reset with prop/callback; update `ChatPanel` accordingly.
7. Normalize flags or introduce simple `InterviewLifecycle` enum; minimize state.
8. Prune logging to info/warn/error with env gating.

Each step should compile independently and preserve current behavior.

---

## 9) Acceptance Criteria

-   No regressions in interview start → code → submit → upload → complete flow.
-   Recording always uploads once and session is patched with `videoUrl`.
-   Timer and camera clean up on end/unmount; no memory leaks.
-   Component shrinks substantially with logic moved into hooks/services.
-   Type-safe, documented interfaces between parent and children.
