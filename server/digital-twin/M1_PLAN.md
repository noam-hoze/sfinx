## M1 Plan – Digital Twin MVP (OpenAI Prompt+RAG)

### Scope

-   [ ] OpenAI-first MVP that produces interviewer-like responses with Prompt+RAG.
    -   [ ] Test: `curl -s -X POST http://localhost:3000/api/digital-twin/respond ...` returns interviewer-style text.
-   [ ] Guidance/scoring JSON emitted per turn; wired into existing interview UI.
    -   [ ] Test: trigger a turn in Interview IDE and confirm UI receives guidance/scoring payload.
-   [ ] Recording/telemetry capture; offline evaluation harness and baseline metrics.
    -   [ ] Test: run a practice interview and verify MP4 upload + telemetry rows in DB.

### Deliverables

1. [x] Respond API
    - [x] POST `/api/digital-twin/respond`
    - [x] Request: `{ interviewerId, sessionId, history[], candidateTurn, controls? }`
    - [x] Response: `{ text, guidance?, scoring?, traces, safety, latencyMs }`
    - [x] Test: `curl -s -X POST http://localhost:3000/api/digital-twin/respond ...` returns 200 with fields above.
2. [ ] Persona + Prompts
    - [ ] Finalized system prompt encoding tone/policies/heuristics.
    - [ ] Few-shot exemplars from held-out sessions.
    - [ ] Test: compare model output on golden conversation vs reference transcript; pass if ≥70% similarity.
3. [ ] RAG Index
    - [ ] Embeddings for interviewer notes, rubric, and exemplar turns.
    - [ ] Top‑k retrieval with recency/semantic blending.
    - [ ] Test: call respond API with a query requiring interviewer note; ensure retrieved snippet referenced in text/traces.
4. [ ] Telemetry & Recording
    - [ ] Use existing session creation, screen-recording upload, and telemetry init.
    - [ ] Append `TelemetryEvent[]` batches for code_edit/run/turn/control.
    - [ ] Test: start interview, perform code edit/run; verify `telemetryData` table updated and recording URL set.
    - [ ] Training Mode (Inverted Roles)
        - [ ] Add dedicated `/training` page: human=microphone interviewer; ElevenLabs candidate agent (configurable `ELEVENLABS_CANDIDATE_AGENT_ID`).
        - [ ] Disable OpenAI twin; connect ElevenLabs agent; record screen+audio; log turns as interviewer (human) and candidate (agent).
        - [ ] Test: run a training session; confirm MP4 saved, turns labeled correctly, and telemetry stored with `mode: "training"`.
5. [ ] Eval Harness
    - [ ] Offline metrics: similarity (BERTScore/BLEURT), latency, safety flags.
    - [ ] Manual checklist for style/indistinguishability on sampled sessions.
    - [ ] Test: run eval script (e.g. `pnpm tsx server/digital-twin/tools/run-eval.ts` once created) and review report.

### Architecture

-   [ ] Orchestrator calls: retrieve → compose prompt → OpenAI completion → post-process → emit JSON.
    -   [ ] Test: enable verbose logging and confirm orchestrator trace includes retrieval, prompt, and OpenAI response.
-   [ ] Safety layer: basic filters and refusal scaffolding per company policy.
    -   [ ] Test: send disallowed input; expect refusal tag and logged safety reason.
-   [ ] Observability: logs, traces, latency, token usage.
    -   [ ] Test: inspect telemetry dashboard/logs after 3 requests; ensure latency/token metrics recorded.

### Prompt Composition

-   [ ] System: interviewer persona, goals, guardrails, JSON schema for guidance/scoring.
    -   [ ] Test: run prompt unit test ensuring persona blocks prohibited tone (e.g. jest snapshot).
-   [ ] Context: top‑k RAG snippets (persona, rubric, exemplar turns); session metadata.
    -   [ ] Test: mock retrieval returning snippet; ensure composed prompt includes snippet text.
-   [ ] User: candidateTurn + compressed recent history.
    -   [ ] Test: submit history with >8 turns; verify prompt truncates to last 8.

### Guidance & Scoring JSON

-   [ ] Guidance: `{ action, topic?, difficulty?, rationale? }`.
    -   [ ] Test: validate sample payload with zod schema; should pass.
-   [ ] Scoring: `{ scores: { tech, comms, ... }, confidence, evidence[] }`.
    -   [ ] Test: validate sample payload with zod schema; should pass.

### Data & Privacy

-   [ ] Use transcripts and notes with consent; PII redaction pre-index.
    -   [ ] Test: run redaction script on raw transcript and confirm removal of PII sample.
-   [ ] Store only hashes/previews for large outputs in telemetry.
    -   [ ] Test: inspect telemetry payload; ensure large outputs replaced with hashes.

### Acceptance Criteria

-   [ ] p95 latency ≤ 1.5s; valid JSON in ≥99% turns.
    -   [ ] Test: run 50-request load test and compute latency/JSON success.
-   [ ] Baseline similarity ≥ 0.70 on held-out; zero critical safety violations.
    -   [ ] Test: execute eval harness and review similarity/safety metrics.
-   [ ] Recording URL saved; telemetry events appended during sessions.
    -   [ ] Test: inspect DB session row after interview; recording URL + telemetry present.

### Risks & Mitigations

-   [ ] Hallucination → stronger RAG and rubric checks.
    -   [ ] Test: run risk playbook prompts; confirm twin refuses or cites sources.
-   [ ] JSON brittleness → response function-calling/JSON schema validators.
    -   [ ] Test: enforce JSON mode and validate 20 responses without parse errors.
-   [ ] Data sparsity → bootstrap with rubric and exemplars; iterate.
    -   [ ] Test: track coverage metrics in eval; ensure each rubric facet represented.

### Out of Scope (M1)

-   [ ] OpenAI fine‑tuning; LoRA adapters (open‑weight alternative).
    -   [ ] Test: confirm no fine-tune jobs in M1 pipeline.
-   [ ] Tool-execution (code runner) beyond rubric/fact checks.
    -   [ ] Test: manual QA ensures respond API never triggers code-run tools.

### Full Flow (1‑Session) Test

-   [ ] Prereqs
    -   [ ] Set `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVEN_LABS_CANDIDATE_AGENT_ID` in `.env.local`; restart dev.
-   [ ] Training mode (inverted roles)
    -   [ ] Open `/interview/training` (optionally `?agentId=...`). Allow mic + screen.
    -   [ ] Speak as interviewer for ~1–2 minutes. Click Submit.
    -   [ ] Verify MP4 at `public/uploads/recordings/recording-*.mp4` and `InterviewSession.videoUrl` updated.
    -   [ ] Verify transcript at `public/uploads/transcripts/transcript-<sessionId>.jsonl` with roles labeled.
    -   [ ] Verify no `/api/digital-twin/respond` calls in Network tab.
-   [ ] Normal mode (twin reply)
    -   [ ] Open `/interview`, speak once; confirm `/api/digital-twin/respond` 200 and ElevenLabs speaks the reply.
    -   [ ] Check response includes `text`, `traces`, `latencyMs`.
-   [ ] Endpoint smoke
    -   [ ] `curl -s -X POST http://localhost:3000/api/digital-twin/respond -H "Content-Type: application/json" -d '{"interviewerId":"demo-int","sessionId":"demo-sess","history":[{"role":"candidate","text":"Hi"}],"candidateTurn":"Can we start?"}'`
    -   [ ] Expect valid JSON; guidance/scoring optional until JSON mode enabled.
