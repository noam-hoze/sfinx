# sfinx-reviewer Memory

## Recurring Violation Patterns
- `console.log` in `app/api/interviews/chat/route.ts` (13+ occurrences)
- Two separate `shared/` trees: `app/shared/` and root `shared/` -- doc conflates them
- Paste topics API returns `name`+`description` only; `percentage`/`coverageScore` added client-side in Redux
- Code evaluation throttle comes from env var, NOT hardcoded to 8 seconds
- `identify-paste-topics` uses env `NEXT_PUBLIC_MAX_PASTE_TOPICS` (not fixed "up to 4")

## Intentional Patterns (do not re-flag)
- `backgroundSlice.forceTimeExpiry` uses `|| 7000` -- may be intentional fallback for testing
- `navigationSlice.loadInitialState` uses try/catch with empty catch blocks -- sessionStorage access guard

## High-Risk Files
- `app/api/interviews/chat/route.ts` -- constitution violation (console.log)
- `app/(features)/interview/components/InterviewIDE.tsx` -- 1400+ line file, many hooks
- `shared/state/slices/codingSlice.ts` -- diverges from doc's CodingState interface

## Key Structural Facts (verified 2026-03-01)
- Redux slices at `shared/state/slices/` (NOT `app/shared/state/slices/`)
- Store at `shared/state/store.ts`
- Logger at `app/shared/services/logger.ts`
- calculateScore at `app/shared/utils/calculateScore.ts`
- Session creation at `POST /api/interviews/session` (NOT `/api/interviews/session/create`)
- No `e2e/` or `shared/tests/` directories exist
- No Dockerfile or docker-compose in codebase
- Features: interview, cps, company-dashboard, job-search, settings (doc misses last two)
