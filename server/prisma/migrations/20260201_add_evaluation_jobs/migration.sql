-- CreateTable
CREATE TABLE "EvaluationJob" (
    "id" TEXT NOT NULL,
    "interviewSessionId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvaluationJob_status_priority_createdAt_idx" ON "EvaluationJob"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "EvaluationJob_interviewSessionId_idx" ON "EvaluationJob"("interviewSessionId");

-- AddForeignKey
ALTER TABLE "EvaluationJob" ADD CONSTRAINT "EvaluationJob_interviewSessionId_fkey" FOREIGN KEY ("interviewSessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
