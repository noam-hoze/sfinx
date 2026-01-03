/*
  Warnings:

  - You are about to drop the column `codeQualityWeight` on the `ScoringConfiguration` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Job" ADD COLUMN     "codingCategories" JSONB;

-- AlterTable
ALTER TABLE "public"."ScoringConfiguration" DROP COLUMN "codeQualityWeight";
