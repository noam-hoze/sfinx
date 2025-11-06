Sfinx Interview Flow - Known OpenAI Realtime Workaround

Context
During the OpenAI Realtime voice interview, we observed that the browser's SPA navigation (client-side routing) does not reliably tear down the active WebRTC session and its transport event handlers in all cases. This can result in the session continuing to receive/send events after redirecting to the jobs board, causing "leaked" transcripts or logs.

Workaround (Temporary)
Upon interview conclusion, we redirect to the jobs board using a hard refresh:

- window.location.href = "/job-search" (fallback to router.push if needed)

Why
- Hard reload guarantees the browser tears down WebRTC connections, handlers, and media tracks immediately, ensuring no residual events leak into the next page.
- We still perform best-effort cleanup (disconnect(), stop mic tracks), but the hard reload is the guardrail.

Future Fix
- When the upstream OpenAI Realtime SDK exposes robust unsubscribe hooks and deterministic teardown across navigation, we can revert to client-side routing without a hard refresh.

## Development Workflow

### Everyday Test-First Delivery
- Begin every Cursor session or feature branch by reproducing the failing scenario with an automated test.
- Write or adjust a failing unit or end-to-end test before changing production code, then iterate until it passes.
- Treat a task as "done" only after both the unit (`pnpm test:unit`) and end-to-end (`pnpm test:e2e`) suites succeed locally.

### Running the Test Suites
- `pnpm test:unit` executes the Vitest unit suite.
- `pnpm test:e2e` renders the login experience with mocked Next.js providers via the smoke spec in `tests/e2e/`.
- `pnpm verify` orchestrates both commands and should be the default before committing or submitting for review.

### FAST_LANE Procedure
Use the fast-lane only when the team deliberately accepts temporary coverage debt:

1. Export the required flags before running `pnpm verify` or pushing to CI:
   - `FAST_LANE=true`
   - `FAST_LANE_REASON="<why the tests cannot run>"`
   - `FAST_LANE_FOLLOW_UP="<link to the follow-up issue or ticket>"`
   - `FAST_LANE_DUE_DATE="<YYYY-MM-DD committed fix date>"`
2. Record the follow-up issue link in the PR/commit description.
3. Reviewers must confirm the follow-up ticket exists, is assigned, and the due date is realistic prior to approval.
4. Clear the FAST_LANE variables once the outstanding work is completed and rerun `pnpm verify`.

