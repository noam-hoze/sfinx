# Sfinx Integration Test Suite

This directory contains integration tests for the Sfinx interview system. All tests are designed to run **without OpenAI API calls**, using deterministic mocks for reproducible results.

## Philosophy

- **Integration over unit tests**: Test complete flows, not isolated functions
- **Deterministic**: No AI calls, predictable mock responses
- **Efficient**: Multiple edge cases tested within single interview simulations
- **Score consistency**: Verify database, CPS, and dashboard show identical scores

## Directory Structure

```
tests/
├── integration/
│   ├── setup/                    # Test infrastructure
│   │   ├── mockOpenAI.ts         # Deterministic AI response mocks
│   │   ├── mockPrisma.ts         # In-memory database simulation
│   │   ├── testFactories.ts      # Test scenario helpers
│   │   └── index.ts              # Exports
│   │
│   ├── interview-flow/           # Background interview tests
│   │   └── background-thresholds.test.ts
│   │
│   ├── coding-session/           # Coding phase tests
│   │   └── paste-detection.test.ts
│   │
│   ├── scoring-consistency/      # Score pipeline tests
│   │   ├── score-pipeline.test.ts
│   │   └── multi-candidate.test.ts
│   │
│   └── evidence-captions/        # Evidence verification (planned)
│
└── README.md
```

## Running Tests

```bash
# Run all integration tests
npx vitest run tests/integration

# Run specific test suite
npx vitest run tests/integration/interview-flow

# Run with watch mode
npx vitest tests/integration

# Run with coverage
npx vitest run tests/integration --coverage
```

## Test Suites

### 1. Background Thresholds (`interview-flow/background-thresholds.test.ts`)

Tests the background interview phase logic:

| Test Area | What's Tested |
|-----------|---------------|
| **Don't Know Threshold** | Category exclusion after N "don't know" responses |
| **Clarification Threshold** | Max retries before moving to next question |
| **Score Accumulation** | Confidence multiplier before target, point accumulation after |
| **Topic Selection** | Contribution collection mode vs rebalance mode |
| **Detection** | Gibberish and clarification request regex patterns |
| **Full Flow** | Complete interview simulation with mixed responses |

**Key Constants:**
- `DONT_KNOW_THRESHOLD`: Default 2 (env: `NEXT_PUBLIC_DONT_KNOW_THRESHOLD`)
- `CLARIFICATION_THRESHOLD`: Default 3 (env: `NEXT_PUBLIC_CLARIFICATION_THRESHOLD`)
- `CONTRIBUTIONS_TARGET`: Default 5 (env: `NEXT_PUBLIC_CONTRIBUTIONS_TARGET`)

### 2. Score Pipeline (`scoring-consistency/score-pipeline.test.ts`)

Tests the scoring calculation algorithm:

| Test Area | What's Tested |
|-----------|---------------|
| **Experience Score** | Weighted average of experience categories |
| **Coding Score** | Weighted average including AI assist accountability |
| **Final Score** | Combined experience + coding with config weights |
| **AI Assist Impact** | How accountability score affects coding score |
| **Edge Cases** | Empty arrays, zero weights, perfect scores |
| **Consistency** | Same inputs always produce same outputs |

**Scoring Formula:**
```
experienceScore = Σ(score × weight) / Σ(weight)
codingScore = (Σ(categoryScore × weight) + aiAssistScore × aiAssistWeight) / (Σ(weight) + aiAssistWeight)
finalScore = (experienceScore × expWeight + codingScore × codeWeight) / (expWeight + codeWeight)
```

### 3. Paste Detection (`coding-session/paste-detection.test.ts`)

Tests AI assist accountability:

| Test Area | What's Tested |
|-----------|---------------|
| **Understanding Levels** | FULL (100), PARTIAL (50), NONE (0) scoring |
| **Single Events** | Recording individual paste events |
| **Aggregation** | Multiple paste events averaged |
| **Final Score Impact** | How accountability affects coding and final score |
| **Heavy Paste Scenarios** | Candidates with many paste events |

### 4. Multi-Candidate (`scoring-consistency/multi-candidate.test.ts`)

Tests score consistency across views:

| Test Area | What's Tested |
|-----------|---------------|
| **Ranking** | Candidates correctly ordered by score |
| **Dashboard Stats** | Highest score, average, count calculations |
| **CPS vs Dashboard** | Stored `finalScore` matches calculated score |
| **Stale Score Detection** | Detecting when DB score diverges from summaries |

## Mock Infrastructure

### mockOpenAI.ts

Provides deterministic responses for:
- Answer evaluation (`createEvaluationResponse`)
- "Don't know" responses (`createDontKnowResponse`)
- Clarification responses (`createClarificationResponse`)
- Paste evaluation (`createPasteEvaluationResponse`)
- Coding evaluation (`createCodingEvaluationResponse`)

**Response Sequences** for multi-turn interviews:
- `createStrongCandidateSequence`: High scores across categories
- `createStrugglingCandidateSequence`: Hits don't know threshold
- `createClarificationSeekingSequence`: Multiple clarification requests

### mockPrisma.ts

In-memory database with:
- All Prisma models (User, Company, Job, InterviewSession, etc.)
- CRUD operations that mirror real Prisma client
- **Operation tracking** for audit/verification
- Reset capability between tests

### testFactories.ts

Helper functions:
- `createTestScenario()`: Full linked entity setup (candidate → company → job → session)
- `createMultipleCandidates()`: Multiple candidates for same job
- `initializeCategoryStats()`: Interview state initialization
- `simulateAnswerProcessing()`: Process mock answers and update stats
- `determineNextFocusTopic()`: Topic selection algorithm
- `calculateExpectedScores()`: Verify score calculations

## Known Issues Being Tested

### Score Inconsistency (CPS vs Dashboard)

The test `should detect inconsistency when finalScore is stale` validates a known issue:

1. **CPS page** calculates scores from `BackgroundSummary.experienceCategories` and `CodingSummary.jobSpecificCategories`
2. **Dashboard** reads `InterviewSession.finalScore` from database
3. If summaries are updated but `finalScore` isn't recalculated, they diverge

**Root Cause:**
- `finalScore` is calculated at multiple points (3+ places)
- Not all code paths trigger recalculation
- No single source of truth

## Adding New Tests

### For new interview features:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
    createTestScenario,
    mockDb,
    initializeCategoryStats,
    simulateAnswerProcessing,
} from '../setup';

describe('New Feature', () => {
    beforeEach(() => {
        mockDb.reset();
    });

    it('should handle new scenario', () => {
        const scenario = createTestScenario({
            experienceCategories: [
                { name: 'Custom Category', weight: 100 },
            ],
        });

        // Test logic here
        expect(scenario.session.id).toBeDefined();
    });
});
```

### For new API endpoints:

1. Add mock responses to `mockOpenAI.ts`
2. Add mock database operations to `mockPrisma.ts`
3. Create test file in appropriate directory
4. Use factories to set up test data

## Future Expansion

- [ ] **Evidence/Caption Tests**: Verify all evidence links and captions created
- [ ] **API Route Tests**: HTTP endpoint tests with supertest
- [ ] **Component Tests**: React component tests with Testing Library
- [ ] **E2E Tests**: Full browser tests with Playwright (already configured)
