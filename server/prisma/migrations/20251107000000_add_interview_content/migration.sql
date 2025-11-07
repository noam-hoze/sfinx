-- CreateTable
CREATE TABLE "InterviewContent" (
    "id" TEXT NOT NULL,
    "backgroundQuestion" TEXT,
    "codingPrompt" TEXT NOT NULL,
    "codingTemplate" TEXT,
    "codingAnswer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InterviewContent_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Job" ADD COLUMN "interviewContentId" TEXT;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_interviewContentId_fkey" FOREIGN KEY ("interviewContentId") REFERENCES "InterviewContent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

