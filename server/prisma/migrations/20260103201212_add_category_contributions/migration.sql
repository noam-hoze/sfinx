-- AlterEnum
ALTER TYPE "public"."EvidenceCategory" ADD VALUE 'JOB_SPECIFIC_CATEGORY';

-- AlterTable
ALTER TABLE "public"."EvidenceClip" ADD COLUMN     "categoryName" TEXT,
ADD COLUMN     "contributionStrength" INTEGER;

-- CreateTable
CREATE TABLE "public"."CategoryContribution" (
    "id" TEXT NOT NULL,
    "interviewSessionId" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "codeChange" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "contributionStrength" INTEGER NOT NULL,
    "caption" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryContribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CategoryContribution_interviewSessionId_categoryName_idx" ON "public"."CategoryContribution"("interviewSessionId", "categoryName");

-- AddForeignKey
ALTER TABLE "public"."CategoryContribution" ADD CONSTRAINT "CategoryContribution_interviewSessionId_fkey" FOREIGN KEY ("interviewSessionId") REFERENCES "public"."InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
