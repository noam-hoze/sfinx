# Conversation Transport Design

## Goals

-   Single source of truth for mic capture, STT, transport selection, and UI orchestration
-   Pluggable candidate engines: ElevenLabs (voice+text) and OpenAI (text-only)
-   Zero duplication: shared mic pipeline; engines differ only in generation and (optional) audio playback

## Components (Logical)

-   MicSession (new)
    -   Owns getUserMedia, mic mute/unmute, lifecycle (start/stop)
    -   Emits events: recording-status(on/off), transcript(user), errors
    -   Abstracts STT provider: uses ElevenLabs realtime session for ASR
-   TransportAdapter
    -   Interface: start(), stop(), sendUserMessage(text), sendContextualUpdate(text?), setClientTools?(tools)
    -   Implementations:
        -   ElevenLabsTransport: voice+text (current behavior), supports client tools passthrough
        -   OpenAITransport: text-only; consumes user transcripts; returns assistant text; no TTS
-   RealTimeConversation (orchestrator)
    -   Wires MicSession ↔ TransportAdapter; forwards UI callbacks: onStartConversation/onEndConversation
    -   Mirrors events to ChatPanel via postMessage: recording-status, transcription(user|ai)
    -   Handles role automation (useConversationRoleBehavior)
-   Client Tools
    -   open_file, write_file(lineEdits|content) → Monaco
    -   Registered on adapter start (where supported) or injected at session start
-   UI
    -   RightPanel indicator driven by onStartConversation/onEndConversation
    -   ChatPanel renders messages from postMessage stream

## Engine Selection

-   Env: NEXT_PUBLIC_CANDIDATE_ENGINE=elevenlabs|openai
-   Training page maps env → roles.candidate
-   Orchestrator selects adapter at runtime; MicSession always starts

## Event & Message Flow

1. Start
    - RealTimeConversation → MicSession.start() (requests mic; emits recording-status:true)
    - RealTimeConversation selects adapter and calls adapter.start()
    - UI turns indicator green (onStartConversation)
2. User speaks
    - MicSession streams to ElevenLabs ASR; emits transcript(user)
    - RealTimeConversation forwards transcript to adapter.sendUserMessage
3. Candidate responds
    - ElevenLabsTransport: emits transcript(ai) and/or audio; RealTimeConversation posts both
    - OpenAITransport: returns text; RealTimeConversation posts transcript(ai) only
4. Tools
    - Adapter receives tool_calls (EL native; OpenAI via HTTP two-step); executes clientTools; posts diffs
5. Stop
    - MicSession.stop() → recording-status:false; adapter.stop(); UI indicator red

## Interfaces (TypeScript sketch)

```ts
export interface MicSession {
    start(): Promise<void>;
    stop(): void;
    setMicMuted(muted: boolean): void;
    onRecordingStatus(cb: (isRecording: boolean) => void): void;
    onTranscript(cb: (text: string, speaker: "user" | "ai") => void): void;
}

export interface TransportAdapter {
    start(): Promise<void>;
    stop(): void;
    sendUserMessage(text: string): Promise<boolean>;
    sendContextualUpdate?(text: string): Promise<void>;
    setClientTools?(tools: Record<string, Function>): void;
}
```

## KB Policy

-   Interviewer KB (ElevenLabs interviewer) remains as-is
-   Candidate KB: none for OpenAI; do not emit KB_UPDATE from candidate
-   Gating for edits is controlled by UI (coding state), not KB

## Migration Plan

-   Phase 1 (done): env toggle; OpenAI text adapter; clientTools; training page engine switch; suppress candidate KB
-   Phase 2: Refactor RealTimeConversation to use MicSession + TransportAdapter; remove direct ElevenLabs coupling
-   Phase 3: Consolidate logs; finalize dependency warnings; add e2e smoke (start → say → tool_call → Monaco update)

## Risks & Mitigations

-   STT dependency on ElevenLabs: if unavailable, introduce fallback Web Speech API behind feature flag
-   Tool-call timing race: pre-register tools and inject at session start; retry registration on connect

## Testing Checklist

-   Start interview → indicator green; recording-status true
-   Say "Hi" → ChatPanel shows user transcript
-   Ask candidate to edit → tool_call executed → Monaco updated
-   Stop interview → indicator red; recording-status false

```

```
