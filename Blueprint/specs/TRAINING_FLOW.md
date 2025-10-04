# **Training Flow**

---

## **Scope (POC)**

-   Voice conversation via ElevenLabs Agent.
-   On explicit request, agent issues **client tool calls** to edit code in your **existing Monaco IDE**.
-   No server-side tools/webhooks; all tools are **client tools** handled in your frontend/orchestrator.

---

## **Success Criteria**

-   Agent speaks + understands questions (full-duplex, barge-in).
-   When prompted (e.g., “add a function…”), agent sends **tool_calls** you execute locally.
-   IDE reflects edits; basic run/feedback loop demonstrated once.

---

## **Minimal Architecture**

-   **Browser (Next.js):** Monaco IDE + Orchestrator WS client.
-   **ElevenLabs Agent:** Realtime convo + function-calling (client tools only).
-   **Local Runner (optional for POC):** simple JS eval/Node sandbox or stub.

---

## **Client Tools (minimum viable)**

-   **`open_file() -> { content }`**

    -   Returns the current Monaco buffer as a string with line numbers: `L1:...\nL2:...`.

-   **`write_file(params) -> { ok: boolean, mode: "replace"|"lineEdits", diffs?: any }`**

    -   **Replace:** `{ content: string }` replaces the entire buffer.
    -   **Line edits:** `{ lineEdits: Array<{ op: "replace"|"insert"|"delete", line: number, text?: string, position?: "before"|"after" }> }`
    -   Edits applied in descending line order; response includes concise `diffs`.
    -   Unified diff patches are out-of-scope for this POC.

_(Exactly two tools for POC: `open_file`, `write_file`.)_

---

## **Wire Protocol (WS with ElevenLabs Agent)**

-   **Inbound:** `client_tool_call` → `{ tool_name, tool_call_id, parameters }`
-   **Outbound:** `client_tool_result` → `{ tool_call_id, result, is_error? }`
-   Also handle: `user_transcript`, `agent_response`, `audio`.

---

## **Frontend Orchestrator (POC logic)**

-   Map `tool_name` → handlers:

    -   `open_file`: return buffer with line numbers.
    -   `write_file`: apply edits or replace; update Monaco; return `diffs`.

-   Dispatch cursor/selection ghosting (optional).
-   Log all tool calls + results for demo.

---

## **State Passed to Agent (prompt context)**

-   **{{task_brief}}** – Current task (1–2 sentences).
-   **{{editor_content}}** – Current editor buffer with line numbers (≤2 KB).
-   **{{last_error}}** – Most recent error/test message (≤512 chars).
-   Instruction: _“Only call tools when I ask you to edit code; otherwise talk.”_

---

## **Agent Prompt (Candidate mode)**

-   **Role:** You are the candidate. Speak conversationally. When explicitly asked to edit code, use client tool calls.
-   **Reading:** Call `open_file()` to fetch buffer.
-   **Editing (preferred):** Call `write_file` with `lineEdits` for specific lines.
-   **Editing (fallback):** Replace full file with `{ content: "..." }` if large.
-   Keep edits minimal; wait for feedback after each.

---

## **Candidate Persona (7.5/10 Frontend)**

-   **Level:** Solid mid-senior frontend developer. Calibrated 7.5/10.
-   **Voice & Delivery:** confident, friendly, concise; pace moderate; energy 6/10; warmth 6/10. Speaks in 1–3 sentences. Thinks aloud briefly; asks one clarifying question only when needed.
-   **Background:**

    -   5–6 years FE experience; last 2 with **TypeScript + React 18 + Next.js (App Router)**.
    -   Built apps with SSR/ISR, forms, auth, dashboards.
    -   Skilled in **Tailwind**, **Zustand/Redux Toolkit**, **React Query**, **Vitest/Jest**, **Playwright**, **Vite/Webpack**.
    -   Familiar with **Web Vitals**, **Lighthouse**, **bundle splitting**, **Suspense**, **REST/GraphQL**, **JWT/cookies**, **CDN caching**.
    -   Accessibility basics (ARIA, focus, color contrast).

-   **Strengths:** clean components, idiomatic TS/React, trade-off awareness, critical tests, clear communication.
-   **Weaknesses:** advanced algorithms, browser internals, complex a11y, Redux middleware depth, advanced CSP.
-   **Behavioral rules:**

    -   State assumptions → outline → code → add one perf + one a11y note.
    -   Prefer readability over cleverness.
    -   Be honest when unsure; outline how to verify.
    -   Avoid secrets, PII, or restricted code.

-   **Calibration anchors:**

    -   Can implement sortable virtualized table with SSR pagination.
    -   Can debug hydration errors.
    -   Struggles with deep custom algorithms.
    -   Knows CSR/SSR/ISR trade-offs.

---

## **Non-Functional (POC)**

-   Latency ≤1.2s.
-   No external network from runner.
-   Path whitelist: `/workspace`.
-   Tool exec ≤3s; debounce edits (≈400ms).

---

## **Out of Scope (POC)**

-   Multi-language compilers.
-   Persistent storage.
-   Auth, grading, analytics.

---

## **Test Plan (10 min)**

1. User: “Open index.js and add a greet() that returns ‘hi’.”
2. Agent: speaks confirmation → emits `write_file` → Monaco updates.

---

## **Deliverables**

-   ElevenLabs Agent config with **client tools** (`open_file`, `write_file`).
-   Minimal Next.js page: Monaco + WS Orchestrator + audio in/out.
-   README with start steps and demo script.

---

## Candidate Mode: OpenAI (Text-Only) — Plan

- [x] Goal: Support `roles.candidate = "openai"` (text-only); reuse `open_file`/`write_file`; no TTS.
- [x] Adapter: `OpenAITextConversation` maps tool_calls ↔ client tools; emits assistant text to ChatPanel.
- [x] Hook: `useOpenAiAsCandidate` exposes `handleUserTranscript`, `getClientTools`, `registerClientTools` (no KB vars).
- [x] Transport stub: Minimal `/api/openai/chat` route for tool-call roundtrip (replace with real API later).
- [x] Wiring: `RightPanel` switches to OpenAI adapter when `roles.candidate==='openai'`.
- [x] Env toggle: `NEXT_PUBLIC_CANDIDATE_ENGINE` selects openai/elevenlabs in training page.
- [x] Candidate KB: No candidate KB emissions (removed from candidate hook).
- [ ] Conversation transport: Refactor `RealTimeConversation` to be engine-agnostic (strategy) and remove ElevenLabs coupling.
- [ ] OpenAI path: Suppress ElevenLabs KB update/logs in `InterviewIDE` when engine is openai.
