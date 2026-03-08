# "I Don't Know" Detection and Topic Exclusion System

**Version**: 1.0.0  
**Status**: Implemented  
**Last Updated**: 2026-01-11

---

## Overview

The "I Don't Know" detection system automatically identifies when candidates express uncertainty about a topic and excludes that topic from future questions after a configurable threshold is reached. This prevents wasting interview time on areas where the candidate has limited experience.

---

## Key Features

1. **Uncertainty Detection**: Detects phrases like "I don't know", "not sure", "no experience", "haven't worked with that"
2. **Per-Category Tracking**: Maintains a `dontKnowCount` for each experience category
3. **Configurable Threshold**: Excludes topics after N "I don't know" responses (default: 2)
4. **Graceful Interview Termination**: Ends background stage if all categories are excluded
5. **Real-time Topic Selection**: Exclusions are computed before each question generation

---

## Architecture

### State Management (Redux)

**Location**: `shared/state/slices/backgroundSlice.ts`

```typescript
interface CategoryStats {
  categoryName: string;
  count: number;
  avgStrength: number;
  dontKnowCount: number; // NEW: tracks "I don't know" responses
}
```

**Reducers**:
- `initializeCategoryStats`: Initializes `dontKnowCount: 0` for all categories
- `updateCategoryStats`: Preserves `dontKnowCount` when updating other stats
- `incrementDontKnowCount`: Increments count for a specific category

### Fast Evaluation API

**Location**: `app/api/interviews/evaluate-answer-fast/route.ts`

**Flow**:
1. Receives `excludedTopics` array from frontend
2. Filters `experienceCategories` to create `activeCategories`
3. OpenAI evaluates answer and returns `isDontKnow: true/false`
4. If `isDontKnow=true` for targeted category, increments `dontKnowCount` in-memory
5. Re-computes exclusions based on updated counts
6. Uses fresh exclusion list for next topic selection
7. Returns `isDontKnow`, `allCategoriesExcluded`, and `updatedCounts`

**Key Logic**:
```typescript
// Step 1: Detect uncertainty in OpenAI prompt
if (answer says "I don't know" or similar) {
  isDontKnow: true
}

// Step 2: Increment count in-memory
if (isDontKnow && targetedCategory === category.name) {
  newDontKnowCount = existing.dontKnowCount + 1;
}

// Step 3: Re-compute exclusions
const newExcludedTopics = updatedCounts
  .filter(c => c.dontKnowCount >= THRESHOLD)
  .map(c => c.categoryName);

// Step 4: Filter active categories
const countsForTopicSelection = updatedCounts.filter(
  c => !newExcludedTopics.includes(c.categoryName)
);

// Step 5: Check if all excluded
if (countsForTopicSelection.length === 0) {
  return { allCategoriesExcluded: true };
}
```

### Answer Handler

**Location**: `shared/services/backgroundInterview/useBackgroundAnswerHandler.ts`

**Flow**:
1. Computes `excludedTopics` from Redux `categoryStats` before API call
2. Sends `excludedTopics` to fast API
3. Receives `isDontKnow` flag in response
4. If `isDontKnow=true`, dispatches `incrementDontKnowCount` for targeted category
5. If `allCategoriesExcluded=true`, dispatches `forceTimeExpiry()` to end interview

---

## Configuration

### Environment Variable

**Variable**: `NEXT_PUBLIC_DONT_KNOW_THRESHOLD`  
**Type**: Integer (≥ 1)  
**Default**: 2  
**Description**: Number of "I don't know" responses before excluding a topic

**Example**:
```env
NEXT_PUBLIC_DONT_KNOW_THRESHOLD=2
```

### Validation

Both the fast API and answer handler validate this environment variable:
- Must be set (no fallback)
- Must be a valid positive integer
- Throws error if missing or invalid (per constitution)

---

## User Experience Flow

### Scenario 1: Candidate unfamiliar with a topic

1. **Q1 (Category A)**: "Can you describe your experience with X?"
   - **Answer**: "I don't know, I haven't worked with X"
   - **Result**: `dontKnowCount[A] = 1`, Category A continues

2. **Q2 (Category A)**: "Have you used any tools related to X?"
   - **Answer**: "No, not really"
   - **Result**: `dontKnowCount[A] = 2`, Category A excluded

3. **Q3 (Category B)**: Switches to next category automatically
   - Category A no longer appears in future questions

### Scenario 2: All categories exhausted

1. Candidate says "I don't know" twice for each of 5 categories
2. After 10 questions, all categories are excluded
3. Fast API returns `allCategoriesExcluded: true`
4. Frontend dispatches `forceTimeExpiry()`
5. Background interview transitions to coding stage

---

## Technical Details

### Timing Fix (Critical)

**Problem**: Initially, `dontKnowCount` was incremented in the frontend *after* the fast API had already determined the next question, causing the third question to still target the excluded category.

**Solution**: Moved the increment logic *into* the fast API before topic selection:
1. OpenAI returns `isDontKnow: true`
2. API immediately increments count in `updatedCounts`
3. API re-computes exclusions based on updated counts
4. API uses fresh exclusion list for `newFocusTopic` calculation
5. Frontend receives the already-incremented counts

### OpenAI Prompt Instructions

**Location**: `app/api/interviews/evaluate-answer-fast/route.ts`

```plaintext
Step 1 - Detect uncertainty:
If the answer says "I don't know" or similar ("not sure", "no experience", 
"haven't worked with that"), set isDontKnow: true
Otherwise set isDontKnow: false
```

**Phrases Detected**:
- "I don't know"
- "Not sure"
- "No experience"
- "Haven't worked with that"
- Similar uncertainty expressions

---

## Integration with Dynamic Topic Prioritization

The exclusion system works seamlessly with the existing 3-phase topic prioritization algorithm:

1. **Phase 1 (Continuity)**: If current topic excluded, skip to Phase 2
2. **Phase 2 (Intelligent Pivot)**: Only considers non-excluded categories with `count < TARGET`
3. **Phase 3 (Depth Building)**: Only considers non-excluded categories

The algorithm naturally handles exclusions by filtering them out before applying prioritization rules.

---

## Error Handling

### Missing Environment Variable
```typescript
if (!DONT_KNOW_THRESHOLD_STR) {
  throw new Error("NEXT_PUBLIC_DONT_KNOW_THRESHOLD environment variable is not set");
}
```

### Invalid Threshold Value
```typescript
if (isNaN(DONT_KNOW_THRESHOLD) || DONT_KNOW_THRESHOLD < 1) {
  throw new Error("NEXT_PUBLIC_DONT_KNOW_THRESHOLD must be a positive integer");
}
```

### All Categories Excluded
```typescript
if (activeCategories.length === 0) {
  return {
    allCategoriesExcluded: true,
    acknowledgment: "Thanks for your responses.",
    nextQuestion: null
  };
}
```

---

## Testing

### Manual Test Case

1. Set `NEXT_PUBLIC_DONT_KNOW_THRESHOLD=2`
2. Start background interview
3. Answer first question with "I don't know"
4. Answer second question (same category) with "I'm not sure"
5. **Expected**: Third question switches to different category
6. Repeat for all categories
7. **Expected**: Interview ends after all categories excluded

### Edge Cases

- **Threshold = 1**: Immediate exclusion after first "I don't know"
- **Single category job**: Interview ends after threshold reached
- **Mixed responses**: Only "I don't know" responses increment count, not low-scoring answers

---

## Constitution Compliance

✅ **No Fallbacks**: Throws errors for missing/invalid config  
✅ **Evidence-First**: Exclusions based on explicit "I don't know" detection  
✅ **Observability**: Logs exclusion events for debugging  
✅ **Modularity**: Self-contained logic in fast API and Redux slice

---

## Related Documentation

- [Dynamic Category Prioritization System](./dynamic-category-prioritization-system.md)
- [Answer Evaluation Optimization](./answer-evaluation-optimization.md)
- [System Design](./system-design.md)

---

## Future Enhancements

1. **Per-job thresholds**: Allow different thresholds for different job types
2. **Partial knowledge detection**: Distinguish between "no knowledge" and "limited knowledge"
3. **Analytics dashboard**: Track exclusion patterns across candidates
4. **Smart recovery**: Allow re-enabling topics if candidate demonstrates knowledge later
