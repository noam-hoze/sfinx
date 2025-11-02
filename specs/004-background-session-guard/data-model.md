# Data Model: Background Session Guard

## Entities

### GuardState
- startedAtMs: number  
- elapsedMs: number  
- zeroRuns: number  
- projectsUsed: number  
- reason?: "timebox" | "projects_cap" | "gate"

### LastTurn
- lastQuestion: string  
- lastAnswer: string

### ControlOutcome
- pillars: { adaptability: number; creativity: number; reasoning: number } (0–100)  
- normalized: { A: number; C: number; R: number } (0–1)  
- weights: { A: number; C: number; R: number } (0–1)  
- rationale: string;

## Rules
- zeroRuns increments only on consecutive 0/0/0 within the active project.  
- projectsUsed increments only when we explicitly switch topic.  
- Transition when earliest of timebox, projects cap, or stopCheck.  
- Silence: no CONTROL → zeroRuns unchanged; timebox may still fire.
