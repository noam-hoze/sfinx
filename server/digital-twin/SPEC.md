## Digital Twin of Interviewer - System Specification

### 1) Objective

-   Build an interviewer digital twin that answers like a specific human interviewer in live interviews.
-   Target: ≥80% response-level match (semantic+style) versus the real interviewer across full sessions.
-   Scope: Server-side service producing responses, guidance, and scoring; pluggable into existing interview UI and session APIs.

### 2) Success Metrics

-   **Response similarity**: ≥80% match on held-out conversations (semantic equivalence + style features).
-   **Conversation-level fidelity**: ≥80% of turns rated “indistinguishable” by blinded evaluators.
-   **Latency**: p95 end-to-end ≤ 1.2s for short-turn responses; ≤ 2.5s with tool usage.
-   **Safety**: Zero policy violations on test suite; <0.5% flagged turns in prod.

### 3) High-Level Architecture

-   **Twin Service (this project)**: Stateless API generating next-turn replies; optionally multi-agent (policy+style) with tool-use.
-   **Model Layer**:
    -   Base LLM: OpenAI (Assistants/Realtime) for reasoning.
    -   Style control: prompt-style module and optional OpenAI fine-tune on interviewer corpus; LoRA only in open‑weight alternative.
    -   Retrieval layer: persona/profile memory + situational facts.
-   **Data Layer**:
    -   Conversation store (transcripts, audio, metadata).
    -   Feature store (style features, embeddings, prosody stats).
    -   Evaluation sets (train/val/test splits per interviewer).
-   **Tooling**:
    -   RAG index (interviewer notes, preferences, domain knowledge).
    -   Function-calling: agenda control, follow-ups, rubric checks.
-   **Observability**:
    -   Telemetry (latency, token usage, function calls).
    -   Quality eval jobs (offline + canary online A/B).

### 4) Data Requirements

-   Historical interviews: transcripts + timestamps; if available, audio.
-   Annotations: intents, question types, follow-up style, acceptance thresholds.
-   Metadata: role, seniority, domain, company guidelines, prohibited topics.
-   Consent/compliance: ensure storage and processing approvals; PII handling and redaction.

### 5) Privacy & Compliance

-   PII redaction pipeline before training.
-   Access controls by interviewer and tenant; audit logging.
-   Configurable retention; encryption at rest and in transit.

### 6) Modeling Approach

-   **Two-track (OpenAI-first)**:
    1. Prompt-engineered baseline: system prompt + RAG persona + style tokens (OpenAI inference).
    2. Optional fine-tune on OpenAI-supported models for style/guidance. For deeper control, LoRA applies only to open‑weight models (alternative path).
-   **Losses/Targets**:
    -   Next-turn generation loss on interviewer turns.
    -   Auxiliary classifiers for style features (directness, warmth, verbosity).
    -   Prosody predictors if using TTS (pace, pauses, intonation cues).
-   **Features**:
    -   Conversation state: topic, difficulty, time-on-question.
    -   Candidate model: skill estimate, confidence, previous answers.
    -   Style controls: follow-up frequency, challenge level, coaching vs screening.

### 7) Inference Flow

1. Receive session context and latest candidate turn.
2. Retrieve persona docs and recent memory via embeddings.
3. Run policy agent (should ask follow-up? probe depth? provide hint?).
4. Generate candidate twin response via OpenAI (prompt+RAG; or fine-tuned OpenAI model when available).
5. Optionally call tools (rubric check, fact retrieval, code runner), then finalize.
6. Return text (and spoke prosody directives if needed) with traces.

### 8) APIs (Proposed)

-   POST `/api/digital-twin/respond`
    -   Request: { interviewerId, sessionId, history[], candidateTurn, controls?, temperature? }
    -   Response: { text, functionCalls?, traces, safety, latencyMs }
-   POST `/api/digital-twin/train`
    -   Request: { interviewerId, datasetRef, options }
    -   Response: { jobId, status }
-   GET `/api/digital-twin/eval/:interviewerId`
    -   Response: { latestScores: { similarity, indistinguishability, safety }, trend }

### 9) Datasets & Training

-   Splits by time: train/val/test chronological; keep final sessions for test.
-   Augmentations: paraphrase negatives, candidate perturbations to stress decision boundaries.
-   Style tagging: automated heuristics + human labels for calibration.
-   Training schedule: base warm start; OpenAI fine-tune when sufficient data; LoRA adapters only in open‑weight alternative; periodic refresh.

### 10) Evaluation

-   Automated metrics: BERTScore/BLEURT for semantics; style-clf agreement; latency; cost.
-   Human eval: blinded pairwise (twin vs real) on turn and session; target ≥80% indistinguishability.
-   Online: canary traffic with fallback; guard via safety filter.

### 11) Safety & Guardrails

-   Input/output filters: toxicity, bias, PHI/PII leakage.
-   Policy prompts and refusal scaffolding per company.
-   Hallucination mitigation: fact-grounding via RAG and rubric checking.

### 12) Integration Points (Existing App)

-   Hooks into `app/(features)/interview` UI via existing session APIs.
-   Uses telemetry routes for logging and evaluation dataset growth.
-   Can reuse ElevenLabs or existing TTS, reading prosody directives.

### 12a) Recording & Data Capture (MVP)

-   Modalities
    -   Screen + system/mic audio: captured via browser `getDisplayMedia` + `getUserMedia`, muxed client-side, uploaded as MP4.
    -   IDE signals: code snapshots, diffs, run events, start/stop coding, timers.
    -   Dialogue turns: candidate utterances, twin prompts/responses, timestamps, function calls.
-   APIs (existing hooks)
    -   POST `/api/interviews/session` — create session (already used by IDE flow).
    -   POST `/api/interviews/session/screen-recording` — upload MP4 (used today).
    -   PATCH `/api/interviews/session/:id` — persist `videoUrl` (used today).
    -   POST `/api/interviews/session/telemetry` — append structured events (code edits, runs, turns).
-   Event schema (telemetry examples)
    -   `{ type: "code_edit", ts, sessionId, beforeHash, afterHash, diffSize }`
    -   `{ type: "run", ts, sessionId, status, outputHash }`
    -   `{ type: "turn", ts, role: "candidate"|"interviewer", text, tokens }`
    -   `{ type: "control", ts, action: "ask_followup"|"hint"|"pace_up" }`
-   Storage
    -   Object storage for MP4; durable URL stored on session.
    -   DB tables for sessions, turns, and telemetry; vector index for turn chunks.
-   Privacy
    -   Consent gate before recording; PII redaction before training.
    -   Least-privilege access; encryption in transit/at rest; configurable retention.

### 12b) Telemetry Event Types (MVP)

-   Endpoint usage
    -   POST `/api/interviews/session/telemetry`
        -   Initialize: `{ interviewSessionId }` (creates zeroed telemetry if missing; current behavior).
        -   Append: `{ interviewSessionId, events: TelemetryEvent[] }` (adds events; server validates and stores).
-   Type definitions (canonical JSON)

```ts
type ISO8601 = string;

interface BaseEvent {
    type: "code_edit" | "run" | "turn" | "control";
    ts: ISO8601; // client timestamp
    sessionId: string;
    source?: "client" | "server" | "ai";
}

interface CodeEditEvent extends BaseEvent {
    type: "code_edit";
    file?: string;
    language?: string;
    diffChars: number; // size hint
    beforeHash?: string;
    afterHash?: string;
    cursor?: { line: number; column: number };
}

interface RunEvent extends BaseEvent {
    type: "run";
    status: "success" | "error";
    durationMs?: number;
    outputHash?: string;
    stdoutPreview?: string; // redacted/trimmed
    stderrPreview?: string; // redacted/trimmed
}

interface TurnEvent extends BaseEvent {
    type: "turn";
    role: "candidate" | "interviewer" | "twin";
    text: string; // redacted per policy
    tokens?: number;
    latencyMs?: number;
    functionCalls?: Array<{ name: string; args?: Record<string, unknown> }>;
}

interface ControlEvent extends BaseEvent {
    type: "control";
    action:
        | "ask_followup"
        | "hint"
        | "pace_up"
        | "pace_down"
        | "topic_shift"
        | "end";
    params?: Record<string, unknown>;
}

type TelemetryEvent = CodeEditEvent | RunEvent | TurnEvent | ControlEvent;

interface TelemetryBatch {
    interviewSessionId: string;
    events: TelemetryEvent[];
}
```

-   Constraints & handling
    -   Max 200 events/batch; payload ≤ 256 KB; drop oversized previews, keep hashes.
    -   Server-side PII redaction on `text`/previews; audit log on drops.
    -   Append-only storage table for events; index by `sessionId`, `ts`, `type`.

### 13) Storage & Infra

-   Vector DB for persona and conversation snippets.
-   Object storage for audio.
-   Relational DB for metadata, jobs, and evaluation scores.
-   Job runner for training/eval (queue + workers).

### 14) Configuration

-   Per-interviewer controls: challenge level, coaching ratio, verbosity, tone.
-   Feature flags for new adapters, guardrails, and tool usage.

### 15) Roadmap (Milestones)

-   M1: Prompt baseline with RAG persona; integrated respond API; offline eval setup.
-   M2: OpenAI fine-tune for style/guidance (or LoRA on open‑weights alternative); ≥70% turn-level match on test.
-   M3: Tool-enabled follow-ups and rubric checks; latency p95 ≤1.5s.
-   M4: Human indistinguishability ≥80% session-level; production rollout with canary.

### 16) Recommended Tools (Open-Source + Hybrid with OpenAI)

-   Reasoning & Orchestration (MVP)
    -   OpenAI (Assistants/Realtime with GPT‑4o mini) for core reasoning, tool use, JSON outputs.
    -   Alternative open-weight path: Llama 3.1 8B/70B Instruct as a swap-in.
-   Data Ingestion (ASR & Diarization)
    -   Whisper/faster‑whisper for high‑quality ASR.
    -   pyannote.audio for speaker diarization to separate interviewer vs candidate.
-   Persona Imitation & Style Adaptation
    -   ParlAI (PersonaChat/ConvAI2) to bootstrap persona imitation experiments.
    -   PEFT/LoRA adapters via AdapterHub with Axolotl/Unsloth on Llama/Mistral (open‑weights only; OpenAI fine‑tuning does not expose LoRA).
-   Memory & Agent Scaffolding
    -   LangGraph or MemGPT for long‑term persona/memory and tool routing.
-   Voice (Optional)
    -   Coqui XTTS v2 or OpenVoice for OSS voice cloning; ElevenLabs as hosted alternative.
-   Hybrid Integration Notes
    -   Use OSS (Whisper/pyannote) to build the training corpus and real‑time transcripts; use OpenAI for inference + RAG; optionally add LoRA on open‑weights for stronger stylistic control.
    -   Emulate style and decision patterns, not identity; follow provider policy and consent requirements.
