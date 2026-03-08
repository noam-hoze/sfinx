# Open Issues

## [ARCH-002] ExternalToolUsage not persisted when candidate pastes only once

**Type:** Bug  
**Severity:** High  
**Area:** `app/(features)/interview/components/chat/OpenAITextConversation.tsx`

### Problem

`ExternalToolUsage` is only written to the DB inside `flushPendingPasteEval`, which is called in two cases:
1. A **second paste** occurs (the new paste flushes the previous one)
2. The **interview ends** (`handleInterviewConcluded` → `flushPendingPasteEval`)

If a real candidate pastes code only once and the interview ends normally (timer expiry without explicit conclusion), the ExternalToolUsage record may never be saved.

### Expected behavior

`ExternalToolUsage` should be persisted immediately (or at least reliably) after a single paste, regardless of whether a second paste occurs or the interview is explicitly concluded.

### Proposed fix

Save the ExternalToolUsage record immediately when the paste evaluation is complete (answer received from candidate), rather than deferring it to the next paste or interview end.

### Impact on E2E tests

`verifyCodingResults` currently polls for `external-tools` after a single paste. This assertion may fail unless the interview ends cleanly via `handleInterviewConcluded`. The test should not work around this by pasting twice — that would mask the bug.

## [ARCH-001] Background summary generated on CPS page load instead of at interview end

**Type:** Architecture / Design flaw  
**Severity:** Medium  
**Area:** `app/(features)/cps/page.tsx`, `app/api/interviews/session/[sessionId]/background-summary/`

### Problem

The background summary (executive summary, category scores, recommendations) is currently generated lazily when the company opens the CPS page. This means:

- No summary exists in the DB until a company user views the candidate
- If the CPS page is never opened, the summary is never created
- The CPS page bears the latency cost of an OpenAI generation call on load
- It is impossible to verify the summary exists in E2E tests without first navigating to the CPS page

### Expected behavior

All evaluation artifacts — including the background summary — should be generated at the end of the interview, before the candidate leaves the flow. The CPS page should only **read** pre-computed data, never trigger generation.

### Proposed fix

Move background summary generation to a post-interview server action or API call triggered when:
1. The background stage completes (timer expiry or `shouldComplete` from `next-question`)
2. Or when the candidate clicks "Start Coding Challenge" on the completion screen

The CPS page should then simply fetch the already-existing summary record.

### Impact on E2E tests

`verifyBackgroundResults` currently has to be called after `page.goto('/cps')` because that's the only trigger. The E2E test (`e2e/interview-flow.spec.ts`) is written to comply with the current behavior — background summary verification is intentionally placed inside the "CPS verification" step.

Once this issue is fixed, the test must be updated:
- Move `verifyBackgroundResults` out of the CPS step and into a dedicated "verify background results" step immediately after `waitForBackgroundComplete`
- Remove the dependency on CPS page load for any assertion correctness
