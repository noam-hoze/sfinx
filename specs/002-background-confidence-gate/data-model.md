# Data Model: Background Confidence Gate

## Entities

### BackgroundAssessment
- pillars: ["adaptability", "creativity", "reasoning"]
- perPillarRationale: Record<string, string>
- evidence: Array<{ id: string; text: string; pillarTags: string[] }>
- confidence: number (0–100)
- lastUpdatedAt: ISO datetime

### InterviewStageState
- stage: "Background" | other stages
- status: "active" | "completed"
- currentConfidence: number (0–100)
- debugVisible: boolean
- transitionedAt?: ISO datetime

## Validation Rules
- confidence must be between 0 and 100 inclusive.
- At least 3 questions asked before transition allowed.
- Stage transition only when confidence >= 95.

## State Transitions
- active → completed: when confidence >= 95 and minQuestionCount >= 3 (single transition).
