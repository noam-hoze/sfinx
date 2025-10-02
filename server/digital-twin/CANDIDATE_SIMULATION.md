### Candidate Simulation – Source of Truth

#### Goal

-   Simulate a human candidate in training mode: model-only with TTS for speech (no STT), writes code in the IDE like a human (speed, bursts, pauses), and emits a structured code timeline for the twin to learn from.

#### Architecture (Training Mode)

-   Interviewer path: human interviewer speaks via ConvAI (voice). This triggers the candidate model.
-   Candidate path (model-only): candidate model → respondWithCandidate → TTS (speak `text`) + codeEdits (never spoken).
-   Code loop: model proposes codeEdits; client applies via human-typing emulator; snapshots/diffs recorded to telemetry.
-   Ordering: chat turns are posted immediately on arrival; code events are time-stamped and versioned.
-   No STT or ConvAI for the candidate. All candidate output is structured and under client control.

#### Candidate Model Interface (Minimal, no RAG)

-   Request
    -   context: { file: string; versionId: string; beforeHash: string; text?: string; slices?: Array<{ range:{start:number,end:number}, text:string }>; outline?: string }
    -   history: last N turns (candidate/interviewer text only)
    -   controls?: { maxEdits?: number; maxEditSize?: number; allowMultiFile?: boolean }
-   Response tool (enforced):
    -   respondWithCandidate { text?: string; codeEdits: Array<{ file: string; range:{ start:number; end:number }; replacement: string }>}.
    -   Strict rule: never include code in `text`; only in `codeEdits`.

#### Versioning & Anchors (client-owned)

-   Client tracks code state; the model is stateless regarding versions.
-   Apply-contract per edit: { versionId, beforeHash } must match current buffer; otherwise reject and rebase (send updated slices, request new edit).
-   After each accepted edit, client computes `afterHash`, mints new `versionId`, updates timeline.

#### Telemetry – Hybrid Timeline

-   code_snapshot (periodic and on milestones)
    -   { type:'code_snapshot', ts, sessionId, role:'candidate', file, versionId, fullTextHash, fullTextPtr|fullText, symbolMapPtr? }
-   code_edit (throttled, ≥50 chars or multi-line)
    -   { type:'code_edit', ts, sessionId, role:'candidate', file, beforeVersionId, afterVersionId, beforeHash, afterHash, diffChars, ranges?: Array<{start,end}>, patch? (≤10KB) }
-   Storage: JSONL (dev) or DB `TelemetryEvent` table with JSONB `payload`; object storage for large `fullText`.
-   Index: (sessionId, ts, type). Anchoring: remarks reference {versionId, file, range|symbolId}.

#### Human Typing Emulator (client)

-   Parameters: targetWPM (default 38), burstSize (3–7 chars), pauseMs ~ log-normal (80–450ms), backspaceRate ~ 3–7%, selectionEditProb ~ 10%.
-   Behavior:
    1. Expand each codeEdit replacement into keystroke ops (insert/delete).
    2. Schedule ops according to speed model; randomize small pauses; occasionally backspace then retype.
    3. Render progressively; allow fast-forward (apply remaining ops immediately) on user command.
    4. Emit micro `code_edit` events every ~1.2s (debounced) and snapshots every 30–60s or milestones.

#### IDE Integration

-   Training page keeps editor writable; normal page read-only until coding phase.
-   Apply emulator ops to the active file; guard concurrent edits with versionId/beforeHash.
-   Maintain chat/code turn order: post chat immediately; code events are async and never block chat.

#### Prompt Spec (Candidate)

-   System: “You are the candidate. Reply briefly in natural language. All code changes must be returned exclusively via codeEdits. Never speak code aloud.”
-   Few-shots: 2–3 examples of small, localized edits (rename, add handler, add test) with concise `text` guidance.

#### Evaluation Signals

-   Temporal: think-time before first edit; burst/pause distribution; edit/run loop cadence.
-   Granularity: micro vs block edits; selection edits; backspace rate.
-   Fidelity targets (v1): median inter-keystroke 120–220ms; ≥60% edits micro-sized; comment→code latency distribution matched to human baseline.

#### Safety & Privacy

-   Redact secrets/PII from snapshots before storage; hash blobs; limit per-event payloads; enforce file allowlist.

#### Flags & Controls

-   NEXT_PUBLIC_TRAINING_CANDIDATE_WRITES=true → enable typing emulator and telemetry.
-   SPEED controls: { targetWPM, burstSize, pauseScale } for demo tuning.

#### Notes on ConvAI vs In‑House

-   ConvAI: no guaranteed silent channel; textual edits risk being spoken. Use only for voice.
-   In-house: full control; use `/respond` + typing emulator; far more reliable for code actions.
