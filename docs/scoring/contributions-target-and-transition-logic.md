# Contributions Target & Transition Logic

**Version:** 1.0.0  
**Date:** January 12, 2026  
**Status:** Implemented

---

## Overview

This document describes the shared constant pattern for `CONTRIBUTIONS_TARGET`, the dual-evaluation Redux correction system, and the transition logic that determines when the background interview phase completes.

---

## Shared Constant: CONTRIBUTIONS_TARGET

### Location

```typescript
// shared/constants/interview.ts
export const CONTRIBUTIONS_TARGET = 3;
```

### Purpose

Defines the number of contributions required per category before the topic selection algorithm switches to the next category. This constant is used across both backend and frontend to ensure consistency.

### Usage

**Backend:**
- `app/api/interviews/evaluate-answer-fast/route.ts` - Topic selection algorithm
- `app/api/interviews/session/[sessionId]/coding-summary-update/route.ts` - Confidence calculation
- `app/api/interviews/session/[sessionId]/background-summary/route.ts` - Confidence calculation
- `app/api/interviews/session/[sessionId]/contributions/route.ts` - Confidence calculation

**Frontend:**
- `shared/services/backgroundInterview/useBackgroundAnswerHandler.ts` - Confidence calculation for transition check
- `app/(features)/interview/components/debug/CodingEvaluationDebugPanel.tsx` - Debug panel display
- `app/shared/components/debug/RealTimeContributionsView.tsx` - Debug panel display

### Confidence Calculation

```typescript
confidence = Math.min(100, (contributionCount / CONTRIBUTIONS_TARGET) * 100)
```

When a category reaches `CONTRIBUTIONS_TARGET` contributions, its confidence becomes 100%, indicating sufficient sample size.

### Rationale for No Fallbacks

All code that references `CONTRIBUTIONS_TARGET` does so directly without fallbacks (e.g., `|| 5`). This ensures any missing or incorrect configuration surfaces as a bug immediately rather than silently defaulting.

---

## Dual-Evaluation Redux Correction

### Problem

Fast evaluation (`evaluate-answer-fast`) may return incorrect scores due to:
- Simplified prompt for speed
- Minimal context
- Model inconsistency

This causes the UI to display stale/incorrect counts, and the topic selection algorithm to make decisions based on inaccurate data.

### Solution

When full evaluation (`evaluate-answer`) completes, it dispatches an update to Redux with the corrected counts:

```typescript
// shared/services/backgroundInterview/useBackgroundAnswerHandler.ts
}).then(async (fullResponse) => {
  const fullData = await fullResponse.json();
  
  // Update Redux with corrected counts from full evaluation
  if (fullData.updatedCounts) {
    dispatch(updateCategoryStats({ stats: fullData.updatedCounts }));
    log.info(LOG_CATEGORY, "[async] Redux updated with full-eval counts");
  }
  
  // ... rest of handler
});
```

### Benefits

1. **UI Accuracy**: Debug panel displays correct counts from full evaluation
2. **Algorithm Accuracy**: Subsequent topic selection uses accurate counts
3. **Self-Correcting**: System automatically fixes fast-eval inaccuracies
4. **No User Impact**: Correction happens in background, no visible delay

### Data Flow

```
User submits answer
       ↓
FAST-EVAL completes (~2-4s)
       ↓
Redux updated with fast-eval counts (may be inaccurate)
       ↓
UI displays next question immediately
       ↓
FULL-EVAL completes (~7-10s, async)
       ↓
Redux updated with full-eval counts (accurate)
       ↓
UI reflects corrected counts
       ↓
Next topic selection uses accurate counts
```

---

## Transition Logic: avgStrength vs Confidence

### Background Interview Completion

The background interview phase ends when ONE of these conditions is met:

1. **All Topics Complete**: All categories reach `avgStrength >= 100`
2. **Timebox Expired**: Time limit is reached (configurable per job, default 7 minutes)

### Previous Behavior (Incorrect)

```typescript
// ❌ INCORRECT: Checked confidence (sample size)
const allComplete = opts.categories.every(cat => cat.confidence >= 100);
```

This ended the interview when all topics reached `CONTRIBUTIONS_TARGET` contributions, regardless of answer quality.

**Problem**: A candidate could give 3 mediocre answers (score 50-60) and progress to coding, even though they haven't demonstrated sufficient expertise.

### Current Behavior (Correct)

```typescript
// ✅ CORRECT: Check avgStrength (answer quality)
const allComplete = opts.categories.every(cat => cat.avgStrength >= 100);
```

This ends the interview only when all topics reach perfect scores (100% average strength).

**Benefit**: Ensures candidates demonstrate exceptional knowledge across all experience categories before progressing to coding.

### Implementation

**Guard Function:**
```typescript
// shared/services/backgroundSessionGuard.ts
export interface CategoryConfidence {
  name: string;
  confidence: number;   // Sample size: (count / TARGET) * 100
  avgStrength: number;  // Answer quality: average of all contribution strengths
}

export function shouldTransition(
  gs: GuardState,
  opts: { clockMs?: number; timeboxMs?: number; categories?: CategoryConfidence[] }
): GuardReason | null {
  // Check if all categories reached avgStrength of 100
  if (opts.categories && opts.categories.length > 0) {
    const allComplete = opts.categories.every(cat => cat.avgStrength >= 100);
    if (allComplete) return "all_topics_complete";
  }

  // Check timebox
  const tMs = elapsedMs(gs, opts.clockMs);
  const limit = /* ... calculate limit ... */;
  if (tMs >= limit) return "timebox";
  
  return null;
}
```

**Usage:**
```typescript
// shared/services/backgroundInterview/useBackgroundAnswerHandler.ts
const categories = updatedCategoryStats.map((stat: any) => ({
  name: stat.categoryName,
  confidence: Math.min(100, (stat.count / CONTRIBUTIONS_TARGET) * 100),
  avgStrength: stat.avgStrength  // No fallback - must be present
}));

const transitionReason = shouldTransition(
  { startedAtMs, timeboxMs },
  { timeboxMs, categories }
);
```

### Edge Cases

**Q: What if a candidate never reaches 100% avgStrength?**  
A: The timebox will trigger and end the interview after the configured time limit.

**Q: What if fast-eval returns incorrect scores?**  
A: Full-eval corrects Redux state, ensuring subsequent transition checks use accurate `avgStrength` values.

**Q: Can avgStrength be missing?**  
A: No - the code intentionally avoids fallbacks (e.g., `|| 0`). If `avgStrength` is missing, it will surface as a bug.

---

## Configuration

### Adjusting CONTRIBUTIONS_TARGET

To change the number of contributions required per category:

1. Update `shared/constants/interview.ts`:
   ```typescript
   export const CONTRIBUTIONS_TARGET = 5; // Or any desired value
   ```

2. No other code changes needed - all references use the shared constant.

### Adjusting Transition Threshold

To change the avgStrength threshold for completion:

1. Update `shared/services/backgroundSessionGuard.ts`:
   ```typescript
   const allComplete = opts.categories.every(cat => cat.avgStrength >= 90); // Or any threshold
   ```

2. Document the rationale for the change.

---

## Summary

| Aspect | Previous | Current |
|--------|----------|---------|
| **Target constant** | Hardcoded `5` in multiple files | Shared `CONTRIBUTIONS_TARGET = 3` |
| **Redux correction** | Fast-eval only | Full-eval corrects Redux |
| **Transition logic** | `confidence >= 100` (sample size) | `avgStrength >= 100` (quality) |
| **Fallbacks** | `|| 0`, `|| 5` throughout | None - bugs surface explicitly |

These changes ensure:
- **Consistency**: Single source of truth for constants
- **Accuracy**: Full-eval corrects fast-eval errors
- **Quality**: Interview ends only when candidate demonstrates exceptional knowledge
- **Debuggability**: Missing data surfaces as bugs, not silent defaults
