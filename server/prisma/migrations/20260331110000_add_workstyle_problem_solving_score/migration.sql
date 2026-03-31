-- Add missing WorkstyleMetrics column used by runtime queries and updates.
ALTER TABLE "public"."WorkstyleMetrics"
ADD COLUMN "problemSolvingScore" INTEGER;
