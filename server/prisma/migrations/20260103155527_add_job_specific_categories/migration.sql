/*
  Warnings:

  - You are about to drop the column `isEvidence` on the `Iteration` table. All the data in the column will be lost.
  - You are about to drop the column `debugLoops` on the `WorkstyleMetrics` table. All the data in the column will be lost.
  - You are about to drop the `Session` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."UnderstandingLevel" AS ENUM ('FULL', 'PARTIAL', 'NONE');

-- CreateEnum
CREATE TYPE "public"."EvidenceCategory" AS ENUM ('ITERATION_SPEED', 'REFACTOR_CLEANUPS', 'AI_ASSIST_USAGE', 'EXTERNAL_TOOL_USAGE', 'ADAPTABILITY', 'CREATIVITY', 'REASONING');

-- DropForeignKey
ALTER TABLE "public"."Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropIndex
DROP INDEX "public"."InterviewSession_applicationId_key";

-- DropIndex
DROP INDEX "public"."InterviewSession_candidateId_applicationId_key";

-- AlterTable
ALTER TABLE "public"."EvidenceClip" ADD COLUMN     "category" "public"."EvidenceCategory";

-- AlterTable
ALTER TABLE "public"."InterviewContent" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."Iteration" DROP COLUMN "isEvidence";

-- AlterTable
ALTER TABLE "public"."TelemetryData" ADD COLUMN     "confidenceCurve" JSONB,
ADD COLUMN     "learningToAction" JSONB,
ADD COLUMN     "persistenceFlow" JSONB;

-- AlterTable
ALTER TABLE "public"."WorkstyleMetrics" DROP COLUMN "debugLoops",
ADD COLUMN     "externalToolUsage" INTEGER,
ALTER COLUMN "iterationSpeed" DROP NOT NULL,
ALTER COLUMN "refactorCleanups" DROP NOT NULL,
ALTER COLUMN "aiAssistUsage" DROP NOT NULL;

-- DropTable
DROP TABLE "public"."Session";

-- CreateTable
CREATE TABLE "public"."ScoringConfiguration" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "adaptabilityWeight" DOUBLE PRECISION NOT NULL DEFAULT 33.33,
    "creativityWeight" DOUBLE PRECISION NOT NULL DEFAULT 33.33,
    "reasoningWeight" DOUBLE PRECISION NOT NULL DEFAULT 33.34,
    "codeQualityWeight" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "problemSolvingWeight" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "independenceWeight" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "iterationSpeedWeight" DOUBLE PRECISION NOT NULL DEFAULT 12.5,
    "aiAssistWeight" DOUBLE PRECISION NOT NULL DEFAULT 12.5,
    "experienceWeight" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "codingWeight" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "iterationSpeedThresholdModerate" INTEGER NOT NULL DEFAULT 5,
    "iterationSpeedThresholdHigh" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoringConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConversationMessage" (
    "id" TEXT NOT NULL,
    "interviewSessionId" TEXT NOT NULL,
    "speaker" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BackgroundSummary" (
    "id" TEXT NOT NULL,
    "telemetryDataId" TEXT NOT NULL,
    "executiveSummary" TEXT NOT NULL,
    "executiveSummaryOneLiner" TEXT,
    "recommendation" TEXT,
    "adaptabilityScore" INTEGER NOT NULL,
    "adaptabilityText" TEXT NOT NULL,
    "adaptabilityOneLiner" TEXT,
    "creativityScore" INTEGER NOT NULL,
    "creativityText" TEXT NOT NULL,
    "creativityOneLiner" TEXT,
    "reasoningScore" INTEGER NOT NULL,
    "reasoningText" TEXT NOT NULL,
    "reasoningOneLiner" TEXT,
    "conversationJson" JSONB NOT NULL,
    "evidenceJson" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackgroundSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CodingSummary" (
    "id" TEXT NOT NULL,
    "telemetryDataId" TEXT NOT NULL,
    "executiveSummary" TEXT NOT NULL,
    "recommendation" TEXT,
    "codeQualityScore" INTEGER NOT NULL,
    "codeQualityText" TEXT NOT NULL,
    "problemSolvingScore" INTEGER NOT NULL,
    "problemSolvingText" TEXT NOT NULL,
    "independenceScore" INTEGER NOT NULL,
    "independenceText" TEXT NOT NULL,
    "finalCode" TEXT,
    "codeQualityAnalysis" JSONB,
    "jobSpecificCategories" JSONB,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodingSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BackgroundEvidence" (
    "id" TEXT NOT NULL,
    "telemetryDataId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "questionText" TEXT NOT NULL,
    "answerText" TEXT NOT NULL,
    "questionNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackgroundEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExternalToolUsage" (
    "id" TEXT NOT NULL,
    "interviewSessionId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pastedContent" TEXT NOT NULL,
    "characterCount" INTEGER NOT NULL,
    "aiQuestion" TEXT NOT NULL,
    "aiQuestionTimestamp" TIMESTAMP(3) NOT NULL,
    "userAnswer" TEXT NOT NULL,
    "understanding" "public"."UnderstandingLevel" NOT NULL,
    "accountabilityScore" INTEGER NOT NULL,
    "reasoning" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalToolUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScoringConfiguration_jobId_key" ON "public"."ScoringConfiguration"("jobId");

-- CreateIndex
CREATE INDEX "ConversationMessage_interviewSessionId_timestamp_idx" ON "public"."ConversationMessage"("interviewSessionId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "BackgroundSummary_telemetryDataId_key" ON "public"."BackgroundSummary"("telemetryDataId");

-- CreateIndex
CREATE UNIQUE INDEX "CodingSummary_telemetryDataId_key" ON "public"."CodingSummary"("telemetryDataId");

-- CreateIndex
CREATE INDEX "BackgroundEvidence_telemetryDataId_idx" ON "public"."BackgroundEvidence"("telemetryDataId");

-- CreateIndex
CREATE INDEX "BackgroundEvidence_timestamp_idx" ON "public"."BackgroundEvidence"("timestamp");

-- CreateIndex
CREATE INDEX "ExternalToolUsage_interviewSessionId_idx" ON "public"."ExternalToolUsage"("interviewSessionId");

-- AddForeignKey
ALTER TABLE "public"."ScoringConfiguration" ADD CONSTRAINT "ScoringConfiguration_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "public"."Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConversationMessage" ADD CONSTRAINT "ConversationMessage_interviewSessionId_fkey" FOREIGN KEY ("interviewSessionId") REFERENCES "public"."InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BackgroundSummary" ADD CONSTRAINT "BackgroundSummary_telemetryDataId_fkey" FOREIGN KEY ("telemetryDataId") REFERENCES "public"."TelemetryData"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CodingSummary" ADD CONSTRAINT "CodingSummary_telemetryDataId_fkey" FOREIGN KEY ("telemetryDataId") REFERENCES "public"."TelemetryData"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BackgroundEvidence" ADD CONSTRAINT "BackgroundEvidence_telemetryDataId_fkey" FOREIGN KEY ("telemetryDataId") REFERENCES "public"."TelemetryData"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExternalToolUsage" ADD CONSTRAINT "ExternalToolUsage_interviewSessionId_fkey" FOREIGN KEY ("interviewSessionId") REFERENCES "public"."InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
