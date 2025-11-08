ALTER TABLE "InterviewContent"
    ADD COLUMN "backgroundQuestionTimeSeconds" INTEGER NOT NULL DEFAULT 900,
    ADD COLUMN "codingQuestionTimeSeconds" INTEGER NOT NULL DEFAULT 1800;

-- Ensure historic rows have the configured defaults.
UPDATE "InterviewContent"
SET "backgroundQuestionTimeSeconds" = 900
WHERE "backgroundQuestionTimeSeconds" IS NULL;

UPDATE "InterviewContent"
SET "codingQuestionTimeSeconds" = 1800
WHERE "codingQuestionTimeSeconds" IS NULL;

