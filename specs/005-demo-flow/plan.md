# Demo Flow - Plan

## Overview
Build a 5-stage demo wizard allowing users to experience the interview process as a candidate and view results as a hiring manager. No authentication required. Timeline: Complete today in 3 phases.

## Stages

### Progress Header (All Pages)
**Component:** `DemoProgressHeader.tsx`
- Horizontal stepper showing all 5 stages
- Always visible at top of every demo page
- Stage names: "Welcome" → "Interview" → "Company View" → "Report" → "Candidates"
- **Visual Design (Apple-like):**
  - Circular dots for each stage connected by lines
  - Current stage: Blue fill, bold text, larger dot
  - Completed stages: Blue checkmark icon, blue text, connected by blue line
  - Future stages: Gray outline dot, gray text, gray line
  - Clean typography (16px stage name below dot)
  - Generous spacing between stages
  - Center-aligned on page
- **Props:** `currentStage: 1 | 2 | 3 | 4 | 5`

### Stage 1: Welcome (`/demo`)
- **Header:** `<DemoProgressHeader currentStage={1} />`
- Explain demo purpose
- CTA button: "Start Interview"
- Navigate to Stage 2

### Stage 2: Interview (`/interview`)
- **Header:** `<DemoProgressHeader currentStage={2} />`
- **REUSE**: Existing `/interview` page
- **Modifications**: Bypass AuthGuard when `?demo=true`, inject progress header
- **Job**: Frontend Engineer at Meta (existing in DB)
- **User**: New demo candidate (to be seeded)
- Creates real interview session in DB
- On completion: Auto-redirect to Stage 3

### Stage 3: Company View (`/demo/company-view`)
- **Header:** `<DemoProgressHeader currentStage={3} />`
- Context switch: "Now view as hiring manager"
- Brief explanation of what they'll see
- CTA button: "View Interview Report"
- Navigate to Stage 4

### Stage 4: CPS Report (`/cps`)
- **Header:** `<DemoProgressHeader currentStage={4} />`
- **REUSE**: Existing `/cps` page
- **Modifications**: Bypass AuthGuard when `?demo=true`, inject progress header
- Show real CPS analysis from completed interview
- CTA button: "View All Candidates"
- Navigate to Stage 5

### Stage 5: Ranked Candidates (`/demo/ranked-candidates`)
- **Header:** `<DemoProgressHeader currentStage={5} />`
- Table with 100 candidates (1 real + 99 mocked)
- Columns: Name, Score, Status, Link to CPS
- Pie chart: Status distribution (Invited vs Completed)
- Most candidates in "Completed" status
- Real candidate highlighted/visible in list

## Constitution Gate Resolutions

### I. Library Scan Gate - Pie Chart
**Candidates:**
- **Recharts** (React-specific, declarative, widely used in Next.js projects)
- Chart.js (canvas-based, framework-agnostic)
- Victory (React-native compatible)

**Decision:** Recharts
**Rationale:**
- Already common in React/Next.js ecosystems
- Declarative API matches our component style
- ~50k weekly downloads, active maintenance
- MIT license
- TypeScript support built-in

**Alternatives rejected:**
- Chart.js: More imperative, requires wrapper component
- Victory: Heavier bundle, overkill for simple pie chart

### II. Reuse-First Strategy
**Existing pages to reuse:**
- `/interview` page (Stage 2)
- `/cps` page (Stage 4)

**Modifications required:**
- Add demo mode detection in AuthGuard/UnauthGuard
- Pass `?demo=true` query param to bypass auth
- Ensure proper data flow via Redux

**New pages (minimal):**
- `/demo` (welcome)
- `/demo/company-view` (context switch)
- `/demo/ranked-candidates` (list + chart)

### III. Function Length Discipline (≤25 lines)
All new functions will be extracted into helpers when approaching limit:
- Mock data generation → `generateMockCandidates.ts`
- Score distribution logic → `calculateScoreDistribution.ts`
- Demo navigation helpers → `demoNavigation.ts`

### IV. No Fallbacks
- Demo mode detection: Explicit `searchParams.get('demo') === 'true'` check
- No `||` operators for defaults
- Missing data fails explicitly with error boundaries

### V. State Management
**Redux store extension:**
- Add `demo` slice to store
- Track: `currentInterviewId`, `demoMode`, `currentStage`
- Persist interview ID between stages

### VI. Database Changes
**New demo candidate user:**
- Email: `demo-candidate@sfinx.demo`
- Name: Dynamic (user provides during interview or auto-generated)
- Role: CANDIDATE
- Seed in DB scripts

**Mock candidates (99):**
- Generate realistic names
- Score range: 60-95 (normal distribution)
- Status: 70% "Completed", 30% "Invited"
- Summary: Placeholder text (to be filled in Phase 3)

## Three-Phase Delivery

### Phase 1: Functionality + Basic Sleek Design
**Goal:** Full flow works, Apple-like clean design matching current theme

**Tasks:**
1. Create demo candidate user seed script
2. Create Redux demo slice
3. Build `DemoProgressHeader` component (Apple-like stepper)
4. Build `/demo` welcome page with progress header (basic clean UI)
5. Modify AuthGuard/UnauthGuard for demo bypass
6. Update `/interview` to show progress header when `demo=true`
7. Update `/interview` redirect logic to go to `/demo/company-view`
8. Build `/demo/company-view` page with progress header (basic clean UI)
9. Modify `/cps` to show progress header when `demo=true`
10. Build `/demo/ranked-candidates` with progress header:
    - Mock data generator (99 candidates)
    - Recharts pie chart integration
    - Basic table component
    - Highlight real candidate
11. Test full flow end-to-end

**Design principles:**
- Match existing color palette (grays, blues from globals.css)
- Clean typography (system fonts)
- Generous white space
- Simple button styles (primary CTA)
- Minimal animations (fade transitions)

### Phase 2: Polish Design
**Goal:** Enhance visual appeal, interactions, micro-animations

**Tasks:**
1. Refine typography hierarchy
2. Add smooth transitions between stages
3. Polish button hover/active states
4. Enhance table design (hover effects, borders)
5. Improve pie chart styling (colors, labels, legend)
6. Add loading states
7. Responsive design adjustments

### Phase 3: Complete Mock Content
**Goal:** Fill in realistic summaries for 99 mock candidates

**Tasks:**
1. Generate varied candidate summaries (technical skills, experience levels)
2. Add realistic interview feedback snippets
3. Vary assessment scores across dimensions
4. Test data quality and variety

## Technical Implementation Details

### File Structure
```
app/
  (features)/
    demo/
      page.tsx                    # Stage 1: Welcome
      components/
        DemoProgressHeader.tsx    # Progress stepper (used on all 5 pages)
      company-view/
        page.tsx                  # Stage 3: Context switch
      ranked-candidates/
        page.tsx                  # Stage 5: Ranked list
        components/
          CandidateTable.tsx
          StatusPieChart.tsx
      utils/
        generateMockCandidates.ts
        demoNavigation.ts

shared/
  state/
    slices/
      demoSlice.ts

server/
  db-scripts/
    seed-candidate/
      demo-candidate.ts
```

### Key Functions (all ≤25 lines)

**DemoProgressHeader.tsx:**
- Component with props: `{ currentStage: 1 | 2 | 3 | 4 | 5 }`
- Renders 5 stage dots with connecting lines
- Helper: `getStageStatus(stageNum: number, currentStage: number)` → 'completed' | 'current' | 'future'
- Helper: `getStageStyles(status: string)` → CSS classes for dot/text/line

**generateMockCandidates.ts:**
- `generateMockCandidates(count: number, realCandidateId: string)`
- `generateRandomName()`
- `generateRandomScore()`
- `generateStatus()`

**demoNavigation.ts:**
- `navigateToStage(stage: number, interviewId?: string)`
- `buildDemoUrl(path: string, params: Record<string, string>)`

**demoSlice.ts:**
- `setInterviewId(state, action)`
- `setDemoMode(state, action)`
- `setCurrentStage(state, action)`

### Auth Bypass Implementation
**Strategy:** Check for `demo=true` query param in guards

**AuthGuard.tsx modification:**
```typescript
// Add before auth check
const searchParams = useSearchParams();
const isDemoMode = searchParams.get('demo') === 'true';
if (isDemoMode) {
  return <>{children}</>;
}
```

**UnauthGuard.tsx modification:**
```typescript
// Similar approach for unauth guard
const isDemoMode = searchParams.get('demo') === 'true';
if (isDemoMode) {
  return <>{children}</>;
}
```

### Interview Redirect Logic
**Current:** `/interview` → (completion) → somewhere
**New:** `/interview?demo=true` → (completion) → `/demo/company-view?interviewId={id}`

Modify interview completion handler to check demo mode and redirect accordingly.

### Data Flow
1. User starts at `/demo`
2. Click "Start Interview" → `/interview?demo=true&jobId={metaFrontendJobId}&userId={demoCandidateId}`
3. Interview creates session, stores in Redux `demo.interviewId`
4. On completion → `/demo/company-view?interviewId={id}`
5. Click "View Interview Report" → `/cps?demo=true&interviewId={id}`
6. Click "View All Candidates" → `/demo/ranked-candidates?interviewId={id}`

### Mock Data Specifications
**Candidate fields:**
- `id`: UUID
- `name`: string (realistic names)
- `score`: number (60-95, normal distribution, mean=78, stddev=8)
- `status`: "Invited" | "Completed"
- `summary`: string (placeholder in Phase 1, filled in Phase 3)
- `cpsLink`: string (URL to `/cps?demo=true&interviewId={id}`)

**Status distribution:**
- 70 Completed
- 30 Invited

### Recharts Implementation
```typescript
// StatusPieChart.tsx
import { PieChart, Pie, Cell, Legend, Tooltip } from 'recharts';

const data = [
  { name: 'Completed', value: completedCount },
  { name: 'Invited', value: invitedCount }
];

const COLORS = ['#3b82f6', '#94a3b8']; // Blue for completed, gray for invited
```

## Documentation Requirements
All new files and functions must have TypeScript doc comments (≤4 lines):

**Example:**
```typescript
/**
 * Generates mock candidate data for demo ranked list.
 * @param count Total candidates to generate
 * @param realCandidateId ID of actual interview candidate to include
 */
export function generateMockCandidates(count: number, realCandidateId: string) {
  // implementation
}
```

## Testing Strategy
**Manual testing focus:**
1. Full flow navigation (all 5 stages)
2. Interview session creation
3. CPS data display
4. Mock data rendering
5. Pie chart rendering
6. Table sorting/highlighting
7. Auth bypass works correctly
8. Non-demo paths unaffected

## Risk & Mitigation
**Risk:** Auth bypass could be exploited
**Mitigation:** Demo mode only works for specific demo user ID, specific job ID

**Risk:** Mock data generation slow
**Mitigation:** Generate once, memoize, store in component state

**Risk:** Real interview data not available in CPS
**Mitigation:** Ensure interview completion handler saves all required data before redirect

## Success Criteria
✅ User completes full 5-stage flow without errors
✅ Real interview session created in DB
✅ CPS shows actual interview analysis
✅ Ranked list displays 100 candidates with real one visible
✅ Pie chart renders correctly
✅ Design matches current theme (clean, Apple-like)
✅ All functions ≤25 lines
✅ All files/functions documented
✅ No fallback operators used

## Timeline
**Phase 1:** ~2 hours (functionality + basic design)
**Phase 2:** ~1 hour (polish)
**Phase 3:** ~1 hour (content)
**Total:** ~4 hours

## Next Steps
1. Run seed script for demo candidate
2. Install recharts dependency
3. Create Redux demo slice
4. Build Stage 1 page
5. Modify guards for demo bypass
6. Build Stages 3 & 5
7. Update interview redirect logic
8. Test full flow
9. Polish design
10. Add mock content

