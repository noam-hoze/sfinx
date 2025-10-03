-   **Scope (POC)**

    -   Voice conversation via ElevenLabs Agent.
    -   On explicit request, agent issues **client tool calls** to edit code in your **existing Monaco IDE**.
    -   No server-side tools/webhooks; all tools are **client tools** handled in your frontend/orchestrator.

-   **Success Criteria**

    -   Agent speaks + understands questions (full-duplex, barge-in).
    -   When prompted (e.g., “add a function…”), agent sends **tool_calls** you execute locally.
    -   IDE reflects edits; basic run/feedback loop demonstrated once.

-   **Minimal Architecture**

    -   **Browser (Next.js)**: Monaco IDE + Orchestrator WS client.
    -   **ElevenLabs Agent**: Realtime convo + function-calling (client tools only).
    -   **Local Runner (optional for POC)**: simple JS eval/Node sandbox or stub.

-   **Client Tools (minimum viable)**

    -   `open_file(path: string) -> { path, content }`
    -   `write_file(path: string, patch?: string, content?: string) -> { path, ok: boolean, diff?: string }`
    -   _(Exactly two tools for POC: `open_file`, `write_file`.)_

-   **Wire Protocol (WS with ElevenLabs Agent)**

    -   **Inbound**: `client_tool_call` → `{ tool_name, tool_call_id, parameters }`
    -   **Outbound**: `client_tool_result` → `{ tool_call_id, result, is_error? }`
    -   **Also handle**: `user_transcript`, `agent_response`, `audio` (stream to player)

-   **Frontend Orchestrator (POC logic)**

    -   Map `tool_name` → handlers:

        -   `open_file`: read from in-memory FS; return content.
        -   `write_file`: apply unified diff or replace; update Monaco; return short diff.

    -   Dispatch **cursor/selection ghosting** (optional nicety).
    -   Log every tool call + result for demo.

-   **State Passed to Agent (prompt context)**

    -   Task brief (1–2 sentences).
    -   Current file path + a **windowed excerpt** (≤1–2 KB).
    -   Last error/test message (≤512 chars).
    -   Instructions: _“Only call tools when I ask you to edit code; otherwise talk.”_

-   **Non-Functional (POC)**

    -   Latency: ≤1.2s perceived turn latency.
    -   Safety: no network from runner; path whitelist under `/workspace`.
    -   Timeouts: tool execution ≤3s; debounced edits (e.g., 400ms).

-   **Out of Scope (POC)**

    -   Multi-language compilers, persistent storage, auth, grading, analytics.

-   **Test Plan (10 min)**

    -   Speak: “Open index.js and add a greet() that returns ‘hi’.”
    -   Verify: Agent speaks; emits `write_file`; Monaco updates.

-   **Deliverables**

    -   Agent config with **client tools** (`open_file`, `write_file`).
    -   Minimal Next.js page: Monaco + WS Orchestrator + audio in/out.
    -   README with start steps and demo script.
