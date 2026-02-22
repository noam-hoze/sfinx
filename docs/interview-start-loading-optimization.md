# Interview Start Loading Optimization

## Goal

Reduce perceived loading time when a candidate starts an interview from ~3–5 seconds down to ~2 seconds by moving expensive work earlier in the candidate journey.

## Problem

The original flow was entirely sequential on the interview page:

1. Create Application record in DB
2. Create InterviewSession + TelemetryData + related records in DB
3. Fetch interview script from API
4. Generate first question via OpenAI
5. Generate announcement TTS audio

Each step waited for the previous one, adding up to 3–5 seconds of a spinner before the candidate saw anything.

## Solution: Move Work Earlier + Run in Parallel

Work is now distributed across three earlier moments in the journey:

### 1. At Login (Auth Time) — `InterviewPreloadContext`

`app/shared/contexts/InterviewPreloadContext.tsx` fires immediately when the user authenticates. It does three things in parallel:

- **Warmup shell creation** — calls `POST /api/interviews/warmup` to pre-create an `Application` (with `status: WARMUP`, no jobId yet), an `InterviewSession`, `TelemetryData`, `WorkstyleMetrics`, and `GapAnalysis`. These shell records exist in the DB before the candidate even browses jobs.
- **Sound effect preloading** — loads `click-button.mp3` and `start-interview.mp3` into memory via `loadAndCacheSoundEffect`.
- **OpenAI client initialization** — instantiates the `OpenAI` client once, shared across all interview hooks.

### 2. On Job Search Page Load — `prefetchInterviewScripts`

`shared/services/backgroundInterview/prefetchScripts.ts` is called after companies load. For every visible job that isn't already cached, it fires a background fetch to `/api/interviews/script` and stores the result in `localStorage` (key: `interview-script-{jobId}-v8`). This is fire-and-forget; failures are silently ignored.

### 3. On Interview Page — Three Parallel Tracks

`shared/services/backgroundInterview/useBackgroundPreload.ts` runs three tracks concurrently via `Promise.all`:

| Track | What it does |
|-------|-------------|
| **Track A (DB)** | Activates the warmup shell via `PATCH /api/interviews/warmup/activate` — writes the real `jobId` and flips status from `WARMUP` → `PENDING`. If a non-WARMUP application already exists for that job, deletes the shell and creates a **new session** on the existing application (with fresh TelemetryData, WorkstyleMetrics, GapAnalysis). Falls back to creating fresh records if warmup is unavailable. |
| **Track B (Content)** | Loads interview script from `localStorage` cache (or fetches from API), then generates the first question + evaluation intent via OpenAI. |
| **Track C (Audio)** | Generates the welcome announcement text and fetches TTS audio, with `localStorage` caching via `cacheBlob`/`getCachedBlob`. |

Tracks A and B run in parallel; Track C (`useAnnouncementGeneration`) runs alongside them via a second `Promise.all` at the page level.

## Schema Changes

`server/prisma/schema.prisma`:

- `Application.jobId` made **nullable** — shell records exist before a job is selected.
- `ApplicationStatus` enum gains `WARMUP` value — distinguishes shell records from real applications.

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/interviews/warmup` | `POST` | Creates shell Application + InterviewSession + TelemetryData + WorkstyleMetrics + GapAnalysis for the authenticated user. Deletes any existing WARMUP shell first (one per user). |
| `/api/interviews/warmup/activate` | `PATCH` | Activates a shell by writing the real `jobId`, flipping status to `PENDING`. If a non-WARMUP application already exists for that job, deletes the shell and creates a **new session** on the existing application (supporting multiple interview attempts with separate videos and evidence). |

## Fallback Behavior

All optimization paths have explicit fallbacks:

- If warmup creation fails at login → interview page creates all records itself (legacy path in Track A).
- If warmup activation fails → Track A falls back to legacy `POST /api/applications/create` + `createInterviewSession`.
- If script cache is empty → Track B fetches from API directly.
- If TTS fails → announcement proceeds without audio (text only).

## Bug Fix: WARMUP Records Break Other Queries

WARMUP applications have `jobId = null`. Any route that accesses `app.job.company.id` without filtering will crash with a null-reference error. The following routes exclude WARMUP applications at the query level:

- `GET /api/companies` — `status: { not: "WARMUP" }` when fetching the user's applied job/company IDs.
- `GET /api/user/applications` — same filter, prevents null crash when building `appliedCompanyIds`.

## Files Changed

```
app/shared/contexts/InterviewPreloadContext.tsx     — auth-time warmup + sound + OpenAI init
app/api/interviews/warmup/route.ts                 — POST: create shell records
app/api/interviews/warmup/activate/route.ts        — PATCH: activate shell with real job
app/api/applications/create/route.ts               — skip WARMUP records in duplicate check; cleanup on create
app/(features)/interview/page.tsx                  — parallel preload orchestration
app/(features)/job-search/page.tsx                 — prefetch scripts on load
app/api/companies/route.ts                         — exclude WARMUP from applied IDs query
app/api/user/applications/route.ts                 — exclude WARMUP from applied IDs query
shared/services/backgroundInterview/useBackgroundPreload.ts  — three-track parallel preload
shared/services/backgroundInterview/prefetchScripts.ts       — script prefetch + localStorage cache
shared/services/backgroundInterview/useAnnouncementGeneration.ts — TTS with caching
server/prisma/schema.prisma                        — nullable jobId, WARMUP enum value
```
