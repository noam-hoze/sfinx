-- CreateEnum
CREATE TYPE "IterationResult" AS ENUM ('CORRECT', 'PARTIAL', 'INCORRECT');

-- AlterTable
ALTER TABLE "InterviewContent" ADD COLUMN "expectedOutput" TEXT;

-- AlterTable
ALTER TABLE "InterviewSession" ADD COLUMN "recordingStartedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Iteration" (
    "id" TEXT NOT NULL,
    "interviewSessionId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "codeSnapshot" TEXT NOT NULL,
    "actualOutput" TEXT NOT NULL,
    "expectedOutput" TEXT NOT NULL,
    "evaluation" "IterationResult" NOT NULL,
    "reasoning" TEXT NOT NULL,
    "matchPercentage" INTEGER NOT NULL,
    "caption" TEXT NOT NULL,
    "isEvidence" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Iteration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Iteration_interviewSessionId_idx" ON "Iteration"("interviewSessionId");

-- AddForeignKey
ALTER TABLE "Iteration" ADD CONSTRAINT "Iteration_interviewSessionId_fkey" FOREIGN KEY ("interviewSessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
