## M1 Plan – Digital Twin MVP (OpenAI Prompt+RAG)

### Scope

-   OpenAI-first MVP that produces interviewer-like responses with Prompt+RAG.
-   Guidance/scoring JSON emitted per turn; wired into existing interview UI.
-   Recording/telemetry capture; offline evaluation harness and baseline metrics.

### Deliverables

1. Respond API
    - POST `/api/digital-twin/respond`
    - Request: `{ interviewerId, sessionId, history[], candidateTurn, controls? }`
    - Response: `{ text, guidance?, scoring?, traces, safety, latencyMs }`
2. Persona + Prompts
    - Finalized system prompt encoding tone/policies/heuristics.
    - Few-shot exemplars from held-out sessions.
3. RAG Index
    - Embeddings for interviewer notes, rubric, and exemplar turns.
    - Top‑k retrieval with recency/semantic blending.
4. Telemetry & Recording
    - Use existing session creation, screen-recording upload, and telemetry init.
    - Append `TelemetryEvent[]` batches for code_edit/run/turn/control.
5. Eval Harness
    - Offline metrics: similarity (BERTScore/BLEURT), latency, safety flags.
    - Manual checklist for style/indistinguishability on sampled sessions.

### Architecture

-   Orchestrator calls: retrieve → compose prompt → OpenAI completion → post-process → emit JSON.
-   Safety layer: basic filters and refusal scaffolding per company policy.
-   Observability: logs, traces, latency, token usage.

### Prompt Composition

-   System: interviewer persona, goals, guardrails, JSON schema for guidance/scoring.
-   Context: top‑k RAG snippets (persona, rubric, exemplar turns); session metadata.
-   User: candidateTurn + compressed recent history.

### Guidance & Scoring JSON

-   Guidance: `{ action, topic?, difficulty?, rationale? }`.
-   Scoring: `{ scores: { tech, comms, ... }, confidence, evidence[] }`.

### Data & Privacy

-   Use transcripts and notes with consent; PII redaction pre-index.
-   Store only hashes/previews for large outputs in telemetry.

### Acceptance Criteria

-   p95 latency ≤ 1.5s; valid JSON in ≥99% turns.
-   Baseline similarity ≥ 0.70 on held-out; zero critical safety violations.
-   Recording URL saved; telemetry events appended during sessions.

### Risks & Mitigations

-   Hallucination → stronger RAG and rubric checks.
-   JSON brittleness → response function-calling/JSON schema validators.
-   Data sparsity → bootstrap with rubric and exemplars; iterate.

### Out of Scope (M1)

-   OpenAI fine‑tuning; LoRA adapters (open‑weight alternative).
-   Tool-execution (code runner) beyond rubric/fact checks.
