/*
  Warnings:

  - You are about to drop the column `adaptabilityOneLiner` on the `BackgroundSummary` table. All the data in the column will be lost.
  - You are about to drop the column `adaptabilityScore` on the `BackgroundSummary` table. All the data in the column will be lost.
  - You are about to drop the column `adaptabilityText` on the `BackgroundSummary` table. All the data in the column will be lost.
  - You are about to drop the column `creativityOneLiner` on the `BackgroundSummary` table. All the data in the column will be lost.
  - You are about to drop the column `creativityScore` on the `BackgroundSummary` table. All the data in the column will be lost.
  - You are about to drop the column `creativityText` on the `BackgroundSummary` table. All the data in the column will be lost.
  - You are about to drop the column `reasoningOneLiner` on the `BackgroundSummary` table. All the data in the column will be lost.
  - You are about to drop the column `reasoningScore` on the `BackgroundSummary` table. All the data in the column will be lost.
  - You are about to drop the column `reasoningText` on the `BackgroundSummary` table. All the data in the column will be lost.
  - You are about to drop the column `adaptabilityWeight` on the `ScoringConfiguration` table. All the data in the column will be lost.
  - You are about to drop the column `creativityWeight` on the `ScoringConfiguration` table. All the data in the column will be lost.
  - You are about to drop the column `reasoningWeight` on the `ScoringConfiguration` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "public"."EvidenceCategory" ADD VALUE 'EXPERIENCE_CATEGORY';

-- AlterTable
ALTER TABLE "public"."BackgroundSummary" DROP COLUMN "adaptabilityOneLiner",
DROP COLUMN "adaptabilityScore",
DROP COLUMN "adaptabilityText",
DROP COLUMN "creativityOneLiner",
DROP COLUMN "creativityScore",
DROP COLUMN "creativityText",
DROP COLUMN "reasoningOneLiner",
DROP COLUMN "reasoningScore",
DROP COLUMN "reasoningText",
ADD COLUMN     "experienceCategories" JSONB;

-- AlterTable
ALTER TABLE "public"."Job" ADD COLUMN     "experienceCategories" JSONB;

-- AlterTable
ALTER TABLE "public"."ScoringConfiguration" DROP COLUMN "adaptabilityWeight",
DROP COLUMN "creativityWeight",
DROP COLUMN "reasoningWeight";
