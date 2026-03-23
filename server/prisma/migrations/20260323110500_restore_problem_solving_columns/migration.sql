-- Restore columns reintroduced in Prisma schema on 2026-03-09.
-- Without this migration, environments upgraded via migrate deploy
-- can crash when querying ScoringConfiguration/WorkstyleMetrics.
ALTER TABLE "public"."ScoringConfiguration"
ADD COLUMN IF NOT EXISTS "problemSolvingWeight" DOUBLE PRECISION;

UPDATE "public"."ScoringConfiguration"
SET "problemSolvingWeight" = 25
WHERE "problemSolvingWeight" IS NULL;

ALTER TABLE "public"."ScoringConfiguration"
ALTER COLUMN "problemSolvingWeight" SET DEFAULT 25,
ALTER COLUMN "problemSolvingWeight" SET NOT NULL;

ALTER TABLE "public"."WorkstyleMetrics"
ADD COLUMN IF NOT EXISTS "problemSolvingScore" INTEGER;
