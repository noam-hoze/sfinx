# Interview Guide — Feature Spec

**Version:** 1.0.0
**Status:** Implementation
**Branch:** feature/interview-guide-landing-page

## Overview

A public, company-branded landing page at `/interview-guide/[companyId]` describing the
4-stage hiring process (AI Screening → First Interview → Second Interview → CEO Conversation).
Each Sfinx client configures their own page content through the company dashboard.

## Requirements

### Public Page (`/interview-guide/[companyId]`)
- Server-rendered, publicly accessible (no authentication required)
- Returns HTTP 404 if company not found OR if `interviewGuideConfig` is null (not yet configured)
- No fallback content — all section data comes exclusively from the database config
- Sections: Hero, Company Culture, Interview Process timeline, What to Expect (tabs), Preparation Tips

### Configuration Editor (`/company-dashboard/interview-guide`)
- Accessible to COMPANY role users only (`AuthGuard`)
- Loads existing config on mount via `GET /api/company/interview-guide`
- Saves via `PUT /api/company/interview-guide` — full config required, no partial saves
- Displays validation errors inline; shows success/error banner after save

### API (`/api/company/interview-guide`)
- `GET` — returns current `interviewGuideConfig` (may be `null`)
- `PUT` — validates and persists a complete `InterviewGuideConfig` object
  - Rejects if `stages` count ≠ 4
  - Rejects if any required string field is empty
  - Returns 401 if unauthenticated, 403 if not COMPANY role

## Data Model

Single `interviewGuideConfig Json?` field added to the `Company` model.
See `/app/shared/types/interviewGuide.ts` for the full TypeScript interface.

## Constitution Compliance

- **No fallbacks:** 404 when config is null; all component props are required
- **Function length ≤25 lines:** Helpers extracted per component
- **Documentation:** All new files and functions include JSDoc comments
- **Unit tests:** `route.test.ts` and `page.test.ts` cover happy paths and error cases
- **Library scan:** No external library required; Prisma JSON field + existing fetch pattern used

## Files

| Path | Purpose |
|------|---------|
| `app/shared/types/interviewGuide.ts` | Shared TS types for the config shape |
| `app/api/company/interview-guide/route.ts` | GET + PUT API handlers |
| `app/api/company/interview-guide/__tests__/route.test.ts` | API unit tests |
| `app/(features)/company-dashboard/interview-guide/page.tsx` | Config editor UI |
| `app/(public)/interview-guide/[companyId]/page.tsx` | Public landing page |
| `app/(public)/interview-guide/[companyId]/__tests__/page.test.ts` | Page unit tests |
| `app/shared/components/Sidebar.tsx` | Added "Interview Guide" nav item |
| `server/prisma/schema.prisma` | Added `interviewGuideConfig Json?` to Company |
