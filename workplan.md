# Cursor AI Prompt — Sfinx MVP (Segmented, Test‑Gated)

> Build a **Next.js 14 (App Router, TypeScript)** MVP that profiles a **TPE benchmark (Noam)**, computes **trait vectors** from coding sessions + transcripts, and **scores candidate similarity**.
> We proceed **segment by segment**. **Do not move forward** until each segment’s **Acceptance Tests** pass.

---

## Segment 0 — Scope & Guardrails

* **Core**: deterministic code/test metrics + light NLP → **trait vector → cosine similarity** to TPE.
* **Out of scope (for now)**: real‑time voice I/O, fancy UI, multi‑tenant auth.
* **Stack**: Next.js 14, Route Handlers, Postgres + Prisma (**pgvector optional**), Monaco Editor, Vitest/Jest runner (sandboxed), ESLint API, `escomplex`, `jscpd`.
* **Security**: Run code in **isolated process** with time/memory limits; **no fs/net**.

**Acceptance Tests**

* [ ] Repo boots with `pnpm dev` (or `npm`), no type errors.
* [ ] Single `/health` returns `{ ok: true }`.

---

## Segment 1 — Project Init

* Create Next.js app (App Router, TS).
* Add packages: `monaco-editor`, `eslint`, `@babel/parser`, `escomplex`, `jscpd`, `zod`, `prisma`, `@prisma/client`, `pg`, `vitest` (or `jest`), `execa`, `multer`, `csv-parse`, `ml-distance`, `ml-confusion-matrix`.
* Add **env** scaffolding (`DATABASE_URL`), **lint** config, **scripts**:

  * `dev`, `build`, `start`, `db:migrate`, `db:seed`, `test`.

**Acceptance Tests**

* [ ] `npm run build` succeeds.
* [ ] ESLint runs on repo.

---

## Segment 2 — DB Schema (Prisma)

* Models:

  * `JD(id, title, summary, tags String[])`
  * `Task(id, jdId FK, title, prompt, hiddenTestsJson, createdAt)`
  * `Session(id, userId, taskId FK, codeBlob, audioUrl?, transcript, metricsJson, vectorJson, createdAt)`
  * `TpeProfile(id, name, traitsJson, vectorJson, createdAt)`
  * `Score(id, sessionId FK, similarity Float, perTraitJson)`
  * `PanelLabel(id, sessionId FK, label Enum: SIMILAR|NOT|UNCERTAIN)`
* Migrate DB; seed: **2 JDs**, **3 tasks/JD**.

**Acceptance Tests**

* [ ] `db:migrate` runs cleanly.
* [ ] Seeded rows visible via `psql` or API `/api/debug/seed`.

---

## Segment 3 — Task Workbench UI `/task/[id]`

* Page with **Monaco** editor, problem prompt, **Run Tests** button.
* Server **/api/run-tests**:

  * Spawns isolated Node process (no fs/net), runs hidden tests against submitted code.
  * Returns: `{ passed, total, timeMs, failingTests[] }`.
* Persist `Session` with code + raw test results.

**Acceptance Tests**

* [ ] Typing in editor → submit → get pass/fail + timings.
* [ ] Session row created with `taskId`, `codeBlob`, test results.

---

## Segment 4 — Static Analysis Pipeline `/api/analyze`

* Given `Session.id`, compute metrics:

  * **Accuracy**: `passed/total`, exec time.
  * **Maintainability**: cyclomatic complexity (escomplex), duplication (jscpd ratio).
  * **Style/Readability**: ESLint error/warn counts; Prettier diff length ratio (optional).
  * **Structure/Decomposition**: number of functions/exported symbols (AST).
  * **Error Handling**: presence of guards/try-catch (AST heuristics).
* Persist `metricsJson`.

**Acceptance Tests**

* [ ] Returns metrics for a synthetic snippet (one with try/catch vs none).
* [ ] Deterministic repeat on same code.

---

## Segment 5 — Vectorization `/api/vectorize`

* **Normalize** metrics to \[0,1] or z-scores per trait; consistent ordering.
* Produce `vectorJson: number[]` and a `perTraitJson` map.
* Store on `Session.vectorJson`.

**Acceptance Tests**

* [ ] Two different codes produce two distinct vectors.
* [ ] Re‑vectorizing same `Session` yields identical values.

---

## Segment 6 — TPE Profiling UI `/profile/noam`

* Page: select **3–5 tasks** → run like a candidate → compute vectors per task.
* **Aggregate Noam vector**: average across sessions; clip outlier trait z-scores (e.g., ±2σ).
* Save **`TpeProfile(name="Noam")`** with `traitsJson` + `vectorJson`.

**Acceptance Tests**

* [ ] After 3+ sessions, **Finalize** produces stored `TpeProfile`.
* [ ] Display per‑trait bars + final averaged vector.

---

## Segment 7 — Similarity Scoring `/api/score` + UI

* **Cosine similarity** between candidate `Session.vectorJson` and `TpeProfile.vectorJson`.
* Return `{ similarity, perTraitDelta }` (candidate − TPE normalized).
* UI on `/task/[id]` result view: **similarity score**, **radar/delta bars**.

**Acceptance Tests**

* [ ] Known “good” snippet > “bad” snippet similarity vs Noam.
* [ ] Per‑trait deltas align with obvious code changes (e.g., remove try/catch → error handling down).

---

## Segment 8 — Transcript Capture & NLP Extraction

* Upload transcript to `Session.transcript` (for now, paste or file).
* **/api/extract**: LLM call (OpenAI) with **function schema** to extract:

  * `clarifying_questions_count`, `reasoning_structure_score` (0–1), `tradeoff_mentions_count`.
* Merge into metrics → re‑vectorize.

**Acceptance Tests**

* [ ] Same transcript → stable extraction (± small variance).
* [ ] Removing “clarifying” lines reduces that count.

> Note: keep all model calls server-side; configurable provider. Vercel AI SDK optional.

---

## Segment 9 — Candidate List & Ranking `/candidates`

* Page that lists candidate `Session`s for a JD, sortable by **similarity**.
* Badge: **SIMILAR / NOT / UNCERTAIN** if panel label exists.
* Row details: similarity, top ±3 trait deltas, pass/fail tests.

**Acceptance Tests**

* [ ] Sorting by similarity works.
* [ ] Rows link to detailed session view.

---

## Segment 10 — Panel Labels Upload `/eval`

* CSV upload: `sessionId,label` where label ∈ {SIMILAR,NOT,UNCERTAIN}.
* Store in `PanelLabel`.
* Show **label coverage** stats.

**Acceptance Tests**

* [ ] Invalid rows rejected with line numbers.
* [ ] Duplicates handled (last‑write wins with warning).

---

## Segment 11 — Metrics & Analysis `/eval/metrics`

* Compute against **binary ground truth** (exclude UNCERTAIN):

  * **ROC‑AUC**, **PR‑AUC**, **Precision\@k (k=5,10)**, **Recall\@k**, **Confusion Matrix**, **Kendall τ** (rank vs label score).
* **Baselines**:

  * **Keyword cosine**: JD text vs candidate code/comments embeddings (naïve).
  * **Generic score**: tests passed/time only (no TPE vector).
* Chart simple tables + curves.

**Acceptance Tests**

* [ ] Metrics compute without NaNs on demo data.
* [ ] Our model ≥ baseline on at least one metric.

---

## Segment 12 — Cross‑JD Holdout

* Ensure **Task** carries `jdId`.
* Add toggle: train thresholds on JD A+B, **report on holdout JD C**.
* Display **metric deltas** (≤10% drop target).

**Acceptance Tests**

* [ ] Holdout split respected (verified by counts).
* [ ] Metrics page shows per‑JD results.

---

## Segment 13 — Leakage/Bias Controls

* Enforce: **profiling tasks** ≠ **candidate tasks** (DB constraint/validation).
* Strip any demographics from transcripts; store only artifacts/code/timings.
* Log prompts/configs + **fixed random seeds** for reproducibility.

**Acceptance Tests**

* [ ] Attempt to reuse profiling task in candidate flow → server 400.
* [ ] Prompt/config log appears per evaluation run.

---

## Segment 14 — Sandbox Hardening

* Runner uses child process with:

  * **`--no-network`** (via policy), **cwd** temp dir, time limit (e.g., 3s), memory cap.
  * Disallow `require('fs')`/`net` via wrapper transform or allowlist.
* Kill runaway processes; return structured error.

**Acceptance Tests**

* [ ] Code trying to read file or fetch → blocked & logged.
* [ ] Infinite loop times out with friendly message.

---

## Segment 15 — Demo Script `/demo`

* Scripted flow:

  * Show **Noam profile** vector.
  * Run **two candidate sessions** live (one close, one far).
  * Show **similarity & trait deltas**, then `/eval/metrics` beating baseline.
* One‑click **reset demo data**.

**Acceptance Tests**

* [ ] Full demo runs end‑to‑end in < 5 minutes locally.
* [ ] Reset clears sessions but keeps tasks/JDs.

---

## Segment 16 — Documentation

* Add **README** + wiki links:

  * **TPE‑Benchmark.md**
  * **SSTP.md** (Strong Test Protocol)
  * **Metrics.md** (explain ROC‑AUC, P\@k, etc.)
* Include **.env.example**, runbook, seed data notes.

**Acceptance Tests**

* [ ] Fresh clone → README steps produce working app.
* [ ] Lint/typecheck/test scripts documented.

---

## Non‑Blocking Enhancements (later)

* Replace paste‑transcript with **Whisper/Deepgram** endpoint.
* Add **pgvector** to store vectors as `vector(32|64)` and enable ANN search.
* UI polish (radar chart with Recharts).

---

## Definition of Done (MVP)

* **Compute** TPE vector (Noam) from ≥3 tasks.
* **Score** candidates vs TPE with cosine similarity and per‑trait deltas.
* **Evaluate** vs panel labels with **ROC‑AUC, P\@k**, and beat at least one baseline.
* **Demo** page shows credible end‑to‑end flow, with leakage/bias controls active.

---

**Rules for Execution**

* Implement **one segment at a time**.
* After each segment, run its **Acceptance Tests**.
* **Stop** and request my confirmation before proceeding to the next segment if tests fail or scope ambiguity arises.
