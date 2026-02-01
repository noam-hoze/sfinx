# Async AI Evaluations System

## Overview

The async evaluation system moves AI-powered interview evaluations from blocking synchronous execution to non-blocking asynchronous background processing. This improves user experience by allowing candidates to exit the interview immediately while evaluations continue in the background.

## Architecture

### Database Schema

**EvaluationJob Model** (`server/prisma/schema.prisma`)
- Tracks individual evaluation tasks
- Fields: `jobType`, `status`, `priority`, `payload`, `result`, `error`, `attempts`
- Status values: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`
- Priority: Higher numbers process first (1-10 scale)

**InterviewSession Status**
- `IN_PROGRESS`: Interview ongoing
- `EVALUATING`: Interview complete, evaluations pending
- `COMPLETED`: All evaluations finished

### Job Types

1. **coding-gaps** (priority 5): Identify gaps in coding solution
2. **coding-summary** (priority 10): Generate comprehensive coding assessment
3. **code-quality-analysis** (priority 4): Analyze code quality metrics
4. **job-specific-coding** (priority 9): Evaluate against job-specific categories
5. **profile-story** (priority 3): Generate candidate narrative

### API Endpoints

#### 1. Enqueue Jobs
**POST** `/api/interviews/enqueue-evaluation-jobs`
- Called when interview completes
- Creates all 5 evaluation jobs atomically
- Sets session status to `EVALUATING`
- Returns immediately (non-blocking)

**Request:**
```json
{
  "sessionId": "session123",
  "finalCode": "...",
  "codingTask": "...",
  "expectedSolution": "..."
}
```

**Response:**
```json
{
  "message": "Evaluation jobs enqueued successfully",
  "jobCount": 5,
  "sessionId": "session123"
}
```

#### 2. Process Jobs
**POST** `/api/interviews/process-evaluation-jobs?batchSize=5`
- Background worker endpoint
- Processes pending jobs by priority
- Retries failed jobs up to `maxAttempts`
- Updates session status when all jobs complete

**Response:**
```json
{
  "message": "Jobs processed",
  "processed": 5,
  "results": [
    {
      "jobId": "job123",
      "jobType": "coding-summary",
      "status": "COMPLETED"
    }
  ]
}
```

#### 3. Check Status
**GET** `/api/interviews/evaluation-status?sessionId=session123`
- Poll endpoint for UI
- Returns overall progress and individual job statuses

**Response:**
```json
{
  "sessionId": "session123",
  "overallStatus": "EVALUATING",
  "progress": 60,
  "stats": {
    "total": 5,
    "completed": 3,
    "failed": 0,
    "pending": 1,
    "processing": 1
  },
  "jobs": [...]
}
```

## Flow

### 1. Interview Completion (InterviewIDE.tsx)
```typescript
// OLD (blocking):
await fetch("/api/interviews/generate-coding-summary", ...);
await fetch("/api/interviews/code-quality-analysis", ...);
// ... 5 sequential API calls (10-30 seconds)

// NEW (non-blocking):
await fetch("/api/interviews/enqueue-evaluation-jobs", {
  method: "POST",
  body: JSON.stringify({ sessionId, finalCode, ... })
});
// Returns immediately (<100ms)
```

### 2. Background Processing
- Worker endpoint called by cron job or manual trigger
- Processes jobs in priority order
- Each job calls the original API endpoint internally
- Retries failed jobs with exponential backoff logic

### 3. UI Polling (CPS Page)
```typescript
// Polls every 3 seconds when status is "EVALUATING"
useEffect(() => {
  const interval = setInterval(async () => {
    const status = await fetch(`/api/interviews/evaluation-status?sessionId=${id}`);
    if (status.overallStatus === "COMPLETED") {
      // Refresh summaries and stop polling
    }
  }, 3000);
}, [sessionStatus]);
```

## Deployment

### Database Migration
Run the migration to create the `EvaluationJob` table:
```bash
pnpm exec prisma migrate deploy
```

Or for development:
```bash
pnpm exec prisma migrate dev
```

### Background Worker Setup

#### Option 1: Vercel Cron (Recommended for production)
Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/interviews/process-evaluation-jobs",
    "schedule": "*/30 * * * * *"
  }]
}
```

#### Option 2: External Cron
Set up external cron to call worker endpoint:
```bash
*/30 * * * * * curl -X POST https://your-domain.com/api/interviews/process-evaluation-jobs
```

#### Option 3: Manual Trigger
For development/testing:
```bash
curl -X POST http://localhost:3000/api/interviews/process-evaluation-jobs?batchSize=10
```

### Environment Variables
```
NEXT_PUBLIC_BASE_URL=https://your-domain.com  # For worker API calls
```

## Benefits

1. **Non-blocking UI**: Candidates can exit immediately after interview
2. **Better UX**: No 10-30 second wait at completion
3. **Scalability**: Background processing handles load better
4. **Resilience**: Automatic retries on failures
5. **Observability**: Track job status and progress
6. **Priority-based**: Critical evaluations (scoring) run first

## Monitoring

### Check Pending Jobs
```sql
SELECT jobType, status, attempts, error
FROM "EvaluationJob"
WHERE status IN ('PENDING', 'PROCESSING')
ORDER BY priority DESC, createdAt ASC;
```

### Check Failed Jobs
```sql
SELECT jobType, error, attempts, createdAt
FROM "EvaluationJob"
WHERE status = 'FAILED'
ORDER BY createdAt DESC;
```

### Session Status
```sql
SELECT status, COUNT(*)
FROM "InterviewSession"
WHERE status = 'EVALUATING'
GROUP BY status;
```

## Testing

1. Complete an interview
2. Verify jobs are enqueued (check database)
3. Manually trigger worker: `POST /api/interviews/process-evaluation-jobs`
4. Check CPS page - should show evaluation progress banner
5. Wait for completion, verify banner disappears
6. Verify all summaries are generated correctly

## Rollback Plan

If issues occur, revert these files:
1. `app/(features)/interview/components/InterviewIDE.tsx`
2. Remove API endpoints in `app/api/interviews/`
3. Run migration rollback (or manually drop `EvaluationJob` table)

Original blocking code is preserved in git history.
