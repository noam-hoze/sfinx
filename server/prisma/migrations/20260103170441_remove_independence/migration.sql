/*
  Warnings:

  - You are about to drop the column `independenceScore` on the `CodingSummary` table. All the data in the column will be lost.
  - You are about to drop the column `independenceText` on the `CodingSummary` table. All the data in the column will be lost.
  - You are about to drop the column `independenceWeight` on the `ScoringConfiguration` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."CodingSummary" DROP COLUMN "independenceScore",
DROP COLUMN "independenceText";

-- AlterTable
ALTER TABLE "public"."ScoringConfiguration" DROP COLUMN "independenceWeight";
