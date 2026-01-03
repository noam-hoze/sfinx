/*
  Warnings:

  - You are about to drop the column `iterationSpeedThresholdHigh` on the `ScoringConfiguration` table. All the data in the column will be lost.
  - You are about to drop the column `iterationSpeedThresholdModerate` on the `ScoringConfiguration` table. All the data in the column will be lost.
  - You are about to drop the column `iterationSpeedWeight` on the `ScoringConfiguration` table. All the data in the column will be lost.
  - You are about to drop the column `problemSolvingWeight` on the `ScoringConfiguration` table. All the data in the column will be lost.
  - You are about to drop the column `iterationSpeed` on the `WorkstyleMetrics` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."ScoringConfiguration" DROP COLUMN "iterationSpeedThresholdHigh",
DROP COLUMN "iterationSpeedThresholdModerate",
DROP COLUMN "iterationSpeedWeight",
DROP COLUMN "problemSolvingWeight",
ALTER COLUMN "codeQualityWeight" SET DEFAULT 50,
ALTER COLUMN "aiAssistWeight" SET DEFAULT 25;

-- AlterTable
ALTER TABLE "public"."WorkstyleMetrics" DROP COLUMN "iterationSpeed";
