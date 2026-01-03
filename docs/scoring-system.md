# Candidate Scoring System

## Overview

The scoring system evaluates candidates across two main dimensions: **Experience** and **Coding**. Each dimension is calculated independently with configurable weights, then combined into a final score (0-100).

## Score Architecture

```mermaid
graph TD
    FinalScore[Final Score 0-100]
    FinalScore --> Experience[Experience Score]
    FinalScore --> Coding[Coding Score]
    
    Experience --> Adapt[Adaptability]
    Experience --> Creative[Creativity]
    Experience --> Reason[Reasoning]
    
    Coding --> JobCat[Job-Specific Categories]
    Coding --> AIAssist[AI Assist Accountability]
    
    JobCat --> Cat1[Category 1]
    JobCat --> Cat2[Category 2]
    JobCat --> CatN[Category N]
```

## Formula

### Final Score
```typescript
finalScore = (
  (experienceScore × experienceWeight) +
  (codingScore × codingWeight)
) / (experienceWeight + codingWeight)
```

**Default weights**:
- `experienceWeight = 50%`
- `codingWeight = 50%`

### Experience Score
```typescript
experienceScore = (
  (adaptability × adaptabilityWeight) +
  (creativity × creativityWeight) +
  (reasoning × reasoningWeight)
) / (adaptabilityWeight + creativityWeight + reasoningWeight)
```

**Default weights**:
- `adaptabilityWeight = 33.33%`
- `creativityWeight = 33.33%`
- `reasoningWeight = 33.34%`

**Data source**: Background interview summary (AI-evaluated from conversation)

### Coding Score
```typescript
codingScore = (
  sum(categoryScore[i] × categoryWeight[i]) +
  (aiAssistAccountability × aiAssistWeight)
) / (sum(categoryWeight[i]) + aiAssistWeight)
```

**Default weights**:
- Job-specific categories: Sum to 100% (e.g., 33%, 33%, 34%)
- `aiAssistWeight = 25%`

**Data sources**:
- Category scores: OpenAI evaluation of final code
- AI Assist: Paste evaluation Q&A performance

## Score Components

### Experience Dimensions

#### 1. Adaptability (0-100)
**Measures**: Flexibility, learning agility, handling change

**Evaluated from**: Background conversation about past experiences

**Example prompts**:
- "Tell me about a time you had to learn a new technology quickly"
- "Describe a project where requirements changed mid-development"

**Scoring criteria**:
- 90-100: Demonstrates exceptional adaptability across contexts
- 75-89: Strong evidence of learning and pivoting
- 60-74: Adequate flexibility, some resistance to change
- Below 60: Limited adaptability or growth mindset

#### 2. Creativity (0-100)
**Measures**: Innovation, problem-solving originality, novel approaches

**Evaluated from**: Background conversation about technical solutions

**Example prompts**:
- "Describe a technical challenge you solved in an unconventional way"
- "Tell me about a feature you designed from scratch"

**Scoring criteria**:
- 90-100: Highly innovative solutions, thinks outside constraints
- 75-89: Good creative problem-solving with practical outcomes
- 60-74: Some creativity, mostly follows standard patterns
- Below 60: Limited creative thinking

#### 3. Reasoning (0-100)
**Measures**: Analytical thinking, logical decision-making, technical depth

**Evaluated from**: Background conversation about technical decisions

**Example prompts**:
- "Walk me through your architectural decisions on a complex project"
- "How did you debug a challenging issue?"

**Scoring criteria**:
- 90-100: Exceptional logical thinking, deep technical reasoning
- 75-89: Strong analytical skills, sound decision-making
- 60-74: Adequate reasoning, some logical gaps
- Below 60: Weak analytical approach

### Coding Dimensions

#### Job-Specific Categories (Dynamic)

**Configured per job**. Example for Frontend Engineer:

**1. TypeScript Proficiency** (33%)
- Type safety usage
- Interface and generic design
- Advanced TypeScript features

**2. React Best Practices** (33%)
- Component composition
- Hooks usage and lifecycle
- State management patterns

**3. Performance Optimization** (34%)
- Code splitting
- Lazy loading
- Rendering optimization

**Scoring**: Each category evaluated independently by GPT-4o against final submitted code.

#### AI Assist Accountability (25%)

**Measures**: Understanding of pasted/AI-generated code

**Evaluation**: Interactive Q&A when paste detected
- Up to 4 key concepts identified from pasted code
- Candidate answers probing questions
- Average of topic coverage scores (0-100)

**Scoring criteria**:
- 90-100: Can explain all concepts in depth
- 75-89: Strong understanding of most concepts
- 60-74: Basic understanding, some gaps
- Below 60: Superficial or incorrect explanations

**N/A Handling**: If no paste events occur, AI Assist is excluded from calculation (shows as "N/A").

## Weight Configuration

### Database Model
```prisma
model ScoringConfiguration {
  jobId String @unique
  
  // Category weights (must sum to 100)
  experienceWeight Float @default(50)
  codingWeight Float @default(50)
  
  // Experience dimension weights (must sum to experienceWeight)
  adaptabilityWeight Float @default(33.33)
  creativityWeight Float @default(33.33)
  reasoningWeight Float @default(33.34)
  
  // Workstyle metric weights
  aiAssistWeight Float @default(25)
}
```

### Per-Job Configuration

Companies can configure weights in the Job edit form:

**Scoring Configuration Section**:
1. **Category Weights**: Experience vs Coding split
2. **Experience Dimensions**: How to weight adaptability, creativity, reasoning
3. **Coding Dimensions**: 
   - Job-specific categories (inline management)
   - AI Assist weight

**Validation**:
- Experience dimensions must sum to 100%
- Job-specific categories must sum to 100%
- Category + Coding weights must sum to 100%

## Calculation Implementation

**File**: `app/shared/utils/calculateScore.ts`

### Interface
```typescript
interface RawScores {
  adaptability: number;
  creativity: number;
  reasoning: number;
  categoryScores: Array<{
    name: string;
    score: number;
    weight: number;
  }>;
}

interface WorkstyleMetrics {
  aiAssistAccountabilityScore: number | null;
}

interface ScoringConfiguration {
  // Weights...
}
```

### Function
```typescript
export function calculateScore(
  rawScores: RawScores,
  workstyle: WorkstyleMetrics,
  config: ScoringConfiguration
): {
  finalScore: number;
  experienceScore: number;
  codingScore: number;
}
```

### Example Calculation

**Input**:
```typescript
rawScores = {
  adaptability: 85,
  creativity: 90,
  reasoning: 80,
  categoryScores: [
    { name: "TypeScript", score: 75, weight: 33 },
    { name: "React", score: 80, weight: 33 },
    { name: "Performance", score: 70, weight: 34 }
  ]
};
workstyle = {
  aiAssistAccountabilityScore: 85
};
config = {
  experienceWeight: 50,
  codingWeight: 50,
  adaptabilityWeight: 33.33,
  creativityWeight: 33.33,
  reasoningWeight: 33.34,
  aiAssistWeight: 25
};
```

**Step 1: Experience Score**
```
= (85 × 33.33 + 90 × 33.33 + 80 × 33.34) / 100
= (2833 + 3000 + 2667) / 100
= 85
```

**Step 2: Coding Score**
```
Categories:
= (75 × 33 + 80 × 33 + 70 × 34) / 100
= (2475 + 2640 + 2380) / 100
= 75

With AI Assist:
= (75 × 100 + 85 × 25) / 125
= (7500 + 2125) / 125
= 77
```

**Step 3: Final Score**
```
= (85 × 50 + 77 × 50) / 100
= (4250 + 3850) / 100
= 81
```

## CPS Display

**File**: `app/(features)/cps/page.tsx`

### Score Breakdown Card
Shows:
- **Final Score**: Large number at top
- **Experience vs Coding**: Bar chart visualization
- Expandable breakdown of all components

### Coding Section
**File**: `app/(features)/cps/components/WorkstyleDashboard.tsx`

Shows each metric as a row:
1. Job-specific categories (dynamic)
   - Category name
   - Description
   - Score with visual indicator
2. External Tools Usage
   - AI Assist Accountability score or "N/A"
3. "View Analysis" button
   - Opens modal with detailed evaluation text

## Debug Tools

### CPS Debug Panel
**Location**: Purple icon in header (when DEBUG_MODE=true)

**Shows**:
- Raw scores for all components
- Calculated experience/coding scores
- Final score calculation
- All weights from configuration
- Full JSON data for debugging

**File**: `app/(features)/cps/components/CPSDebugPanel.tsx`

### Interview Debug Panel
**Location**: Interview page, "Test Evaluation" button

**Shows**:
- Real-time evaluation results
- API responses for each scoring component
- Paste evaluation Q&A history

## Edge Cases

### Missing Data

**No background summary**:
```typescript
experienceScore = null;
finalScore = codingScore;  // 100% from coding
```

**No coding summary**:
```typescript
codingScore = null;
finalScore = experienceScore;  // 100% from experience
```

**No AI assist data** (no paste events):
```typescript
aiAssistAccountabilityScore = null;
// Exclude from coding calculation
codingScore = sum(categoryScores) / totalCategoryWeight;
```

**No job-specific categories**:
```typescript
categoryScores = [];
codingScore = aiAssistAccountabilityScore;  // 100% from AI assist
```

### Zero Scores

**Zero is valid**: Represents poor performance, not missing data.

```typescript
if (score === 0) {
  // Include in calculation
}
if (score === null) {
  // Exclude from calculation
}
```

### Weight Validation

**Frontend validation**:
- Real-time sum display
- Warning if ≠ 100%
- Blocks save if invalid

**Backend validation**:
- API validates weight sums
- Returns 400 error if invalid
- Logs validation failures

## Historical Changes

### Removed Metrics (Jan 2026)

1. **Code Quality Weight**: Replaced by dynamic job categories
2. **Problem Solving**: Merged into job-specific categories
3. **Independence**: Removed (redundant with other metrics)
4. **Iteration Speed**: Removed (too noisy, hard to interpret)

**Migration**:
- Database migrations removed obsolete fields
- Scoring calculation updated to exclude
- UI components removed old displays
- Default weights adjusted to sum to 100%

### Weight Adjustments

**Before**:
- Code Quality: 50%
- AI Assist: 12.5%
- Problem Solving: 25%
- Independence: 12.5%

**After**:
- Job Categories: 75% (combined, then split by custom weights)
- AI Assist: 25%

## Best Practices

### For Companies

1. **Weight allocation**:
   - Prioritize most important skills
   - Balance between experience and coding
   - Adjust based on role seniority

2. **Category definition**:
   - Be specific in descriptions
   - Focus on measurable skills
   - Avoid overlapping categories

3. **Calibration**:
   - Review scores across multiple candidates
   - Adjust weights if needed
   - Consider industry benchmarks

### For Developers

1. **Adding new metrics**:
   - Add to appropriate model (Experience/Coding/Workstyle)
   - Update calculation function
   - Add UI display component
   - Include in debug panel

2. **Modifying weights**:
   - Update database defaults
   - Add migration for existing records
   - Update seed data
   - Test calculation edge cases

3. **Testing**:
   - Unit test calculation function
   - Test all N/A scenarios
   - Verify UI displays correctly
   - Check debug panel accuracy

## Future Enhancements

- Machine learning score normalization
- Historical percentile rankings
- Team-based scoring aggregations
- Custom formulas per company
- A/B testing different weight configurations
- Automated weight optimization based on hiring outcomes

