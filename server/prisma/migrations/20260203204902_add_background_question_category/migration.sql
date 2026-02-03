/*
  Warnings:

  - Added the required column `codingLanguage` to the `InterviewContent` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."InterviewContent" ADD COLUMN     "backgroundQuestionCategory" TEXT,
ADD COLUMN     "codingLanguage" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."InterviewSession" ADD COLUMN     "finalScore" INTEGER;
