### Candidate Simulation

#### Goal

-   Integrate a candidate model with TTS-only speech (no STT). It only writes code when explicitly asked by the interviewer, via a human-typing emulator, and emits a structured, time-ordered code timeline.

#### Architecture (Training Mode)

-   Interviewer path: a real human interviewer speaks via mic.
-   Candidate path (model-only): candidate model → respondWithCandidate → TTS (speak `text`) + codeEdits (never spoken; only when asked).
-   Code loop: model proposes codeEdits; client applies via human-typing emulator.
-   Ordering: chat turns are posted immediately on arrival; code events are time-stamped and versioned.
-   No STT for the candidate. All candidate output is structured and under client control.

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

#### Human Typing Emulator (client)

-   Parameters: targetWPM (default 38), burstSize (3–7 chars), pauseMs ~ log-normal (80–450ms), backspaceRate ~ 3–7%, selectionEditProb ~ 10%.
-   Behavior:
    1. Expand each codeEdit replacement into keystroke ops (insert/delete).
    2. Schedule ops according to speed model; randomize small pauses; occasionally backspace then retype.
    3. Render progressively; allow fast-forward (apply remaining ops immediately) on user command.

#### IDE Integration

-   Training page keeps editor writable; normal page read-only until coding phase.
-   Training route: `/interview/training`.
-   Apply emulator ops to the active file; guard concurrent edits with versionId/beforeHash.
-   Maintain chat/code turn order: post chat immediately; code events are async and never block chat.
-   Strict turn-taking: the candidate is either speaking (TTS) or typing, never both at once.

#### Prompt Spec (Candidate)

-   System: “You are the candidate. Reply in natural language. Only write code when the interviewer asks you to. All code changes must be returned exclusively via codeEdits. Never speak code aloud.”
-   Few-shots: 2–3 examples of small, localized edits (rename, add handler, add test) with concise `text` guidance.
-   Traits (0–100% each): Independent, Creative, Resilient, TestingRigor, DocumentationRigor, Pragmatism vs Perfectionism, RiskAversion, Pace, Verbosity.
-   Prompt template (concrete):
    -   System: “You are the candidate. You speak via TTS when not coding. Only write code when explicitly asked to code. Return code only via codeEdits; never include code in speech.”
    -   Persona: “Independent={independent}%, Creative={creative}%, Resilient={resilient}%, TestingRigor={testingRigor}%, DocumentationRigor={documentationRigor}%, Pragmatism={pragmatism}%, RiskAversion={riskAversion}%, Pace={pace}%, Verbosity={verbosity}%.”
    -   Behavior:
        1. When asked to code, propose small, localized edits first; iterate.
        2. Never type and talk at the same time; respect turn-taking.
        3. Testing and docs depth scale with TestingRigor and DocumentationRigor.
        4. Do not modify multiple files unless asked or clearly required.

#### Safety & Privacy

-   Redact secrets/PII from any logs; enforce a strict file allowlist.

#### Flags & Controls

-   SPEED controls: { targetWPM, burstSize, pauseScale } for demo tuning.
-   Access: only company users have access to the training feature.

#### Voice Path (Training)

-   Interviewer: real human via mic.
-   Candidate: TTS for responses; no STT.
