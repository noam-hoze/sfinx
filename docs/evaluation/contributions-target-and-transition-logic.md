# Contributions Target & Transition Logic

**Version:** 2.0.0  
**Date:** March 8, 2026  
**Status:** Implemented with known limitation

---

## Overview

This document describes the per-job contribution target model, the dual-evaluation Redux correction system, and the transition logic that determines when the background interview phase completes.

The system no longer uses one shared `CONTRIBUTIONS_TARGET` constant for every interview. Each job now owns two thresholds in `ScoringConfiguration`:

- `backgroundContributionsTarget`
- `codingContributionsTarget`

These thresholds control evidence confidence, not final background completion. Background completion still depends on `avgStrength` quality or timebox expiry.

---

## Per-Job Contribution Targets

### Location

```prisma
model ScoringConfiguration {
  aiAssistWeight                Float
  experienceWeight              Float
  codingWeight                  Float
  backgroundContributionsTarget Int
  codingContributionsTarget     Int
}
```

### Meaning

**`backgroundContributionsTarget`**
- Minimum accepted background contributions per experience category before confidence reaches 100%
- Used by topic routing to decide whether a category is still under-sampled
- Used by background confidence calculations and debug progress

**`codingContributionsTarget`**
- Minimum accepted coding contributions per coding category before confidence reaches 100%
- Used by coding summary aggregation and debug progress

### Confidence Calculation

```typescript
confidence = Math.min(1.0, contributionCount / target)
adjustedScore = Math.round(rawAverage * confidence)
```

When a category reaches its target, confidence becomes `1.0`, meaning the score is no longer discounted for low sample size.

### Current Runtime Behavior

The implementation reads these values live from the job's current `ScoringConfiguration` on each request.

This means:
- editing a job's contribution targets affects subsequent requests immediately
- an in-progress interview can change behavior mid-session if the company edits the job config

### Known Limitation

This live-read behavior is an implementation shortcut, not the desired long-term behavior.

**Desired behavior:** snapshot both contribution targets onto the interview session when the interview starts, then use the session-scoped snapshot for all later reads.

Until that snapshot design is implemented, mid-interview config edits can affect:
- background topic routing
- background confidence-adjusted category scores
- coding confidence-adjusted category scores
- debug progress displays

---

## Usage

### Background Target Usage

`backgroundContributionsTarget` is used in:
- `app/api/interviews/next-question/route.ts`
- `app/api/interviews/evaluate-answer-fast/route.ts`
- `app/api/interviews/score-answer/route.ts`
- `app/api/interviews/evaluate-answer/route.ts`
- `app/api/interviews/session/[sessionId]/contributions/route.ts`
- `app/api/interviews/session/[sessionId]/background-summary/route.ts`

### Coding Target Usage

`codingContributionsTarget` is used in:
- `app/api/interviews/session/[sessionId]/coding-summary-update/route.ts`
- `app/(features)/interview/components/debug/CodingEvaluationDebugPanel.tsx`
- `app/shared/components/debug/RealTimeContributionsView.tsx`

### Client Transition Check

The client-side background transition check no longer recomputes confidence from a global constant. It uses confidence values already returned by the server-side scoring flow.

---

## Dual-Evaluation Redux Correction

### Problem

Fast evaluation may return inaccurate counts or scores because it optimizes for latency, not depth.

### Solution

When the full background evaluation completes, Redux is corrected with the authoritative counts from the full evaluation response.

```typescript
if (fullData.updatedCounts) {
  dispatch(updateCategoryStats({ stats: fullData.updatedCounts }));
}
```

### Benefits

1. UI reflects corrected counts after full evaluation
2. Later topic selection uses better data
3. Fast evaluation stays responsive without permanently corrupting state

---

## Transition Logic: avgStrength vs Confidence

### Background Interview Completion

The background interview phase ends when one of these conditions is met:

1. All categories reach `avgStrength >= 100`
2. The background timebox expires

### Important Distinction

`backgroundContributionsTarget` does **not** directly end the background interview.

It only controls:
- whether a category still needs more evidence
- how strongly raw category scores are trusted before enough samples exist

The completion gate checks `avgStrength`, not confidence.

```typescript
const allComplete = opts.categories.every(cat => cat.avgStrength >= 100);
```

This prevents a candidate from advancing simply by accumulating enough mediocre answers.

---

## Configuration

### Company Configuration Surface

These values are configured per job through the existing scoring configuration flow:
- `GET /api/company/jobs/[jobId]/scoring-config`
- `PUT /api/company/jobs/[jobId]/scoring-config`
- company dashboard job create/edit forms

### Rollout / Defaults

- New jobs create a `ScoringConfiguration` row with both targets populated
- Existing jobs are backfilled to the schema default target value during migration/repair flows
- Runtime reads do not fall back to env or hardcoded defaults; missing scoring config is treated as an invariant failure

---

## Summary

| Aspect | Previous | Current |
|--------|----------|---------|
| Target model | One shared env-backed target | Two per-job targets on `ScoringConfiguration` |
| Background routing | Global threshold | `backgroundContributionsTarget` |
| Coding confidence | Global threshold | `codingContributionsTarget` |
| Completion gate | `avgStrength >= 100` | `avgStrength >= 100` |
| In-progress config behavior | Not applicable | Live job config reads can affect current interviews |

The current implementation improves per-job control, but session snapshotting is still required to make interview behavior immutable once a session starts.
