-- AlterTable
ALTER TABLE "public"."ScoringConfiguration"
ADD COLUMN "backgroundContributionsTarget" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN "codingContributionsTarget" INTEGER NOT NULL DEFAULT 5;
