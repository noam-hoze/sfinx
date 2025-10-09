### Conversational Engine + OpenAI Realtime Voice (WS) — Requirements & Design

#### Goals

-   **Modular engine**: Decouple `RealTimeConversation` from ElevenLabs with a neutral engine interface.
-   **OpenAI voice via WebSocket**: Add a server WS proxy that bridges browser audio/text to OpenAI Realtime, hides secrets, and streams audio back.
-   **Drop-in switch**: Choose engine by prop/env without changing UI or orchestration logic.

#### Non‑Goals (Now)

-   Turn-taking arbitration/hold–resume logic (will be added later server-side).
-   Client tools/code-edit RPCs.
-   Multi-speaker or multi-session mixing.

### Architecture Overview

-   **ConversationEngine (core interface)**
    -   Required: `start()`, `stop()`, `sendUserMessage(text)`, `sendContextUpdate(payload)`, event subscription (`on(event, handler)` or callbacks), derived state `status`, `isSpeaking`.
    -   Optional capabilities: `supportsAudioIn`, `supportsAudioOut` (voice), `supportsTools` (future).
-   **Engines**
    -   `ElevenLabsEngine`: wraps `@elevenlabs/react` usage and current semantics.
    -   `OpenAIEngine`: browser connects to our WS `/api/openai/realtime`, streams PCM16, receives audio+transcripts.
-   **UI Orchestrator**
    -   `RealTimeConversation` selects engine via prop/env (e.g., `NEXT_PUBLIC_CONVERSATION_ENGINE=elevenlabs|openai`).
    -   Keeps existing mic capture, indicators, and parent callbacks. No EL-specific code remains here.
    -   Minimal, neutral state machine hook (rename `useElevenLabsStateMachine` → `useConversationStateMachine`), with EL-specific nudges split out or gated by engine.

### Engine Interface (TypeScript)

```ts
export type ConversationEvent =
    | { type: "status"; status: "disconnected" | "connecting" | "connected" }
    | { type: "speaking"; isSpeaking: boolean }
    | {
          type: "transcript";
          role: "user" | "assistant";
          text: string;
          final?: boolean;
      }
    | { type: "audio"; chunkBase64: string }
    | { type: "error"; error: any };

export interface ConversationEngine {
    start(opts?: any): Promise<void>;
    stop(): void;
    sendUserMessage(text: string): Promise<void>;
    sendContextUpdate(update: any): Promise<void>;
    on(listener: (e: ConversationEvent) => void): () => void; // returns unsubscribe
    readonly status: "disconnected" | "connecting" | "connected";
    readonly isSpeaking: boolean;
    readonly capabilities?: {
        supportsAudioIn: boolean;
        supportsAudioOut: boolean;
        supportsTools?: boolean;
    };
}
```

### Server: OpenAI Realtime WS Proxy

-   **Route**: `app/api/openai/realtime/route.ts` (Node runtime; WS upgrade). If Edge is required, use `WebSocketPair` pattern; otherwise attach a `ws` server handler.
-   **Upstream**: Connect to `wss://api.openai.com/v1/realtime` with `Authorization: Bearer <OPENAI_API_KEY>` and `model = env.OPENAI_REALTIME_MODEL` and `voice = env.OPENAI_VOICE` (via initial session message or params).
-   **Bridge**:
    -   Client→Server: `{type:"start"}`, `{type:"stop"}`, `{type:"user_message", text}`, `{type:"context_update", payload}`, `{type:"audio_chunk", pcm16Base64}`.
    -   Server→Client: `{type:"status"}`, `{type:"speaking", isSpeaking}`, `{type:"transcript", role, text, final}`, `{type:"audio", chunkBase64}`, `{type:"error", ...}`.
-   **Auth/Security**: Validate user session (NextAuth/JWT), rate-limit per session, never expose API key.
-   **Cleanup**: Close upstream on client disconnect; drain pending audio; guard against backpressure.

### Client: OpenAIEngine

-   Capture mic via `getUserMedia` → `AudioWorklet`/`ScriptProcessor` → PCM16 frames; send as `audio_chunk` over WS.
-   Play back audio via WebAudio `AudioContext` (decode Opus/PCM chunk; OpenAI commonly returns opus frames base64—transmux or decode; fall back to WAV/PCM16 stream if configured).
-   Emit `transcript`/`speaking`/`status` events to `RealTimeConversation`.
-   Support `sendUserMessage` and `sendContextUpdate` as structured JSON; no KB string shims.

### `RealTimeConversation` Integration Changes

-   Accept `engine: "elevenlabs" | "openai"` prop (default from env).
-   Instantiate the appropriate engine once; wire:
    -   `onStartConversation` → `engine.start()` after mic permission.
    -   `onEndConversation`/unmount → `engine.stop()` and mic cleanup.
    -   Engine events → existing UI updates and `window.parent.postMessage` for ChatPanel.
-   Remove direct imports of `@elevenlabs/react` and `/api/convai` from this component.

### Environment & Config

-   `OPENAI_API_KEY` (server only)
-   `OPENAI_REALTIME_MODEL` (e.g., `gpt-4o-realtime-preview`)
-   `OPENAI_VOICE` (e.g., `verse`, `alloy`)
-   `NEXT_PUBLIC_CONVERSATION_ENGINE=elevenlabs|openai`

### Error Handling & Resilience

-   Graceful WS reconnect (client) with jitter; reject if upstream session closed.
-   Timeouts for start/first-byte.
-   Backpressure guards (pause mic if outbound queue > threshold).
-   Fallback: text-only mode if audio init fails.

### Migration Plan

1. Introduce `ConversationEngine` types and `ElevenLabsEngine` wrapper (no behavior change).
2. Build `/api/openai/realtime` WS proxy and `OpenAIEngine`.
3. Refactor `RealTimeConversation` to select engine; remove EL imports and signed-URL code.
4. Rename `useElevenLabsStateMachine` → `useConversationStateMachine` (keep EL-specific nudge behind a feature flag or separate hook).
5. Add env toggle and test matrix (audio permissions, connect, speak, stop).

### Acceptance Criteria

-   UI works unchanged with either engine: connect, speak, show transcript, stop.
-   No secrets in the browser; all OpenAI traffic proxied via our WS.
-   Engine switch via env/prop without code changes elsewhere.
-   Clean mic and WS teardown; no memory leaks; console logs show clear status transitions.

### Future: Turn‑Taking (Out of Scope Now)

-   Server arbiter: gate responses until allowed; manage VAD; enforce max utterance durations.
-   Protocol additions: `{type:"hold"}`, `{type:"allow_next"}`, `{type:"barge_in"}`.
