-- CreateTable
CREATE TABLE "public"."InterviewSession" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "videoUrl" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TelemetryData" (
    "id" TEXT NOT NULL,
    "interviewSessionId" TEXT NOT NULL,
    "matchScore" INTEGER NOT NULL,
    "confidence" TEXT NOT NULL,
    "story" TEXT NOT NULL,
    "hasFairnessFlag" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelemetryData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkstyleMetrics" (
    "id" TEXT NOT NULL,
    "telemetryDataId" TEXT NOT NULL,
    "iterationSpeed" INTEGER NOT NULL,
    "debugLoops" INTEGER NOT NULL,
    "refactorCleanups" INTEGER NOT NULL,
    "aiAssistUsage" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkstyleMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GapAnalysis" (
    "id" TEXT NOT NULL,
    "telemetryDataId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GapAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Gap" (
    "id" TEXT NOT NULL,
    "gapAnalysisId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "evidenceLinks" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EvidenceClip" (
    "id" TEXT NOT NULL,
    "telemetryDataId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "duration" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "startTime" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceClip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VideoChapter" (
    "id" TEXT NOT NULL,
    "telemetryDataId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startTime" INTEGER NOT NULL,
    "endTime" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoChapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VideoCaption" (
    "id" TEXT NOT NULL,
    "videoChapterId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "startTime" INTEGER NOT NULL,
    "endTime" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoCaption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InterviewSession_applicationId_key" ON "public"."InterviewSession"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewSession_candidateId_applicationId_key" ON "public"."InterviewSession"("candidateId", "applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "TelemetryData_interviewSessionId_key" ON "public"."TelemetryData"("interviewSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkstyleMetrics_telemetryDataId_key" ON "public"."WorkstyleMetrics"("telemetryDataId");

-- CreateIndex
CREATE UNIQUE INDEX "GapAnalysis_telemetryDataId_key" ON "public"."GapAnalysis"("telemetryDataId");

-- AddForeignKey
ALTER TABLE "public"."InterviewSession" ADD CONSTRAINT "InterviewSession_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InterviewSession" ADD CONSTRAINT "InterviewSession_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "public"."Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TelemetryData" ADD CONSTRAINT "TelemetryData_interviewSessionId_fkey" FOREIGN KEY ("interviewSessionId") REFERENCES "public"."InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkstyleMetrics" ADD CONSTRAINT "WorkstyleMetrics_telemetryDataId_fkey" FOREIGN KEY ("telemetryDataId") REFERENCES "public"."TelemetryData"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GapAnalysis" ADD CONSTRAINT "GapAnalysis_telemetryDataId_fkey" FOREIGN KEY ("telemetryDataId") REFERENCES "public"."TelemetryData"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Gap" ADD CONSTRAINT "Gap_gapAnalysisId_fkey" FOREIGN KEY ("gapAnalysisId") REFERENCES "public"."GapAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EvidenceClip" ADD CONSTRAINT "EvidenceClip_telemetryDataId_fkey" FOREIGN KEY ("telemetryDataId") REFERENCES "public"."TelemetryData"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VideoChapter" ADD CONSTRAINT "VideoChapter_telemetryDataId_fkey" FOREIGN KEY ("telemetryDataId") REFERENCES "public"."TelemetryData"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VideoCaption" ADD CONSTRAINT "VideoCaption_videoChapterId_fkey" FOREIGN KEY ("videoChapterId") REFERENCES "public"."VideoChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
