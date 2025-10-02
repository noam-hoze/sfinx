### Candidate Simulation – Implementation Checklist

Each task includes an accompanying unit/integration test. After completing a task, write its test and run the test suite.

-   [x] Create training page route `/interview/training`

    -   [x] Implement page layout with writable editor in training mode; read-only elsewhere
    -   [x] Test: renders for company users; non-company blocked/redirected; editor is writable

-   [x] Access control for companies

    -   [x] Gate the training page/components to authenticated company users only
    -   [x] Test: company user passes; candidate/unauthenticated users receive 403/redirect

-   [x] Candidate model endpoint and contract

    -   [x] Implement request schema: `context`, `history`, optional `controls`
    -   [x] Enforce response tool: `respondWithCandidate { text?, codeEdits[] }`
    -   [x] Enforce: never include code in `text`; only return code in `codeEdits`
    -   [x] Enforce: only allow `codeEdits` when interviewer explicitly asked to code
    -   [x] Test: schema validation, reject code-in-text, reject edits when not asked, accept valid responses

-   [x] Prompt builder with traits and few-shots

    -   [x] Build system + persona (traits 0–100%) + behavior rules + 2–3 few-shots
    -   [x] Test: template fills traits, includes rules (no code in speech; code only when asked)

-   [x] TTS integration for candidate speech

    -   [x] Add TTS client and audio playback queue for candidate `text`
    -   [x] Test: plays speech in order, handles cancellation, errors surfaced without crashing UI

-   [x] Turn-taking coordinator (no simultaneous talk/type)

    -   [x] Implement state machine: Idle ↔ Speaking ↔ Typing; mutual exclusivity
    -   [x] Test: disallow transitions that overlap; ensure queued mode changes work

-   [x] Human typing emulator

    -   [x] Generate keystroke ops with parameters: targetWPM, burstSize, pause distribution, backspace rate, selection edit probability
    -   [x] Implement fast-forward to apply remaining ops immediately
    -   [x] Test: emulator transforms `codeEdits` into expected final text; fast-forward preserves correctness

-   [x] Versioning apply-contract

    -   [x] Validate `{ versionId, beforeHash }` against current buffer before applying edits
    -   [x] Compute `afterHash`, mint new `versionId` after accepted edits
    -   [x] Test: rejects stale edits; accepts correct ones; produces deterministic `afterHash`

-   [x] Code edit application to active file

    -   [x] Apply `codeEdits` ranges atomically with conflict guards; single-file by default
    -   [x] Test: multi-edit sequences yield expected buffer; out-of-range edits rejected

-   [x] IDE integration

    -   [x] Wire typing emulator to active editor buffer; guard concurrent edits with versioning checks
    -   [x] Test: UI updates progressively during typing; blocks external concurrent writes

-   [x] Safety & privacy

    -   [x] Implement strict editable file allowlist for training
    -   [x] Redact PII/secrets in logs; avoid storing content beyond runtime needs
    -   [x] Test: attempts to edit disallowed files blocked; secret-like strings redacted in logs

-   [x] End-to-end training flow (integration)
    -   [x] Flow: interviewer speaks → candidate TTS reply → when asked to code, `codeEdits` returned → typing emulator applies with version checks → no talk/type overlap
    -   [x] Test: integration with mocks for model + TTS validates the entire sequence

Notes

-   Use `pnpm test` to run unit/integration tests after each task is implemented.
-   Telemetry/storage is out of scope for training mode; do not persist session timelines.
