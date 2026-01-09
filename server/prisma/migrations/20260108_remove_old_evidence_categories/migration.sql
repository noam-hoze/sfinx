-- Remove old enum values from EvidenceCategory
-- This is a manual migration because PostgreSQL can't drop enum values directly

-- Step 1: Create new enum type without old values
CREATE TYPE "EvidenceCategory_new" AS ENUM (
  'AI_ASSIST_USAGE',
  'EXTERNAL_TOOL_USAGE',
  'JOB_SPECIFIC_CATEGORY',
  'EXPERIENCE_CATEGORY'
);

-- Step 2: Alter column to use new enum type (safe since no data uses old values)
ALTER TABLE "EvidenceClip" 
  ALTER COLUMN "category" TYPE "EvidenceCategory_new" 
  USING ("category"::text::"EvidenceCategory_new");

-- Step 3: Drop old enum type
DROP TYPE "EvidenceCategory";

-- Step 4: Rename new enum type to original name
ALTER TYPE "EvidenceCategory_new" RENAME TO "EvidenceCategory";
