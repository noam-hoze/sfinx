/*
  Warnings:

  - You are about to drop the column `problemSolvingScore` on the `CodingSummary` table. All the data in the column will be lost.
  - You are about to drop the column `problemSolvingText` on the `CodingSummary` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."CodingSummary" DROP COLUMN "problemSolvingScore",
DROP COLUMN "problemSolvingText";
