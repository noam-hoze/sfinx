/**
 * Verifies logger usage and correlation context across files that replaced console logging.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const filesWithContext = [
  {
    file: "app/(features)/company-dashboard/ApplicantsByJob.tsx",
    requiredPatterns: ["log.error", "errorMessage"],
  },
  {
    file: "app/(features)/cps/components/EvidenceReel.tsx",
    requiredPatterns: ["log.warn", "errorMessage"],
  },
  {
    file: "app/(features)/cps/page.tsx",
    requiredPatterns: ["log.info", "errorMessage"],
  },
  {
    file: "app/api/candidates/[id]/basic/route.ts",
    requiredPatterns: ["requestId", "log.error"],
  },
  {
    file: "app/api/company/jobs/[jobId]/applicants/route.ts",
    requiredPatterns: ["requestId", "log.error"],
  },
  {
    file: "app/api/interviews/chat/route.ts",
    requiredPatterns: ["requestId", "log.info", "log.error"],
  },
  {
    file: "app/api/interviews/evaluate-answer-fast/route.ts",
    requiredPatterns: ["requestId", "log.info", "log.error"],
  },
  {
    file: "app/api/interviews/evaluate-answer/route.ts",
    requiredPatterns: ["requestId", "log.info", "log.error"],
  },
  {
    file: "app/api/interviews/evaluate-output/route.ts",
    requiredPatterns: ["requestId", "log.error"],
  },
  {
    file: "app/api/interviews/generate-profile-story/route.ts",
    requiredPatterns: ["requestId", "log.info", "log.error"],
  },
  {
    file: "app/api/interviews/session/[sessionId]/iterations/route.ts",
    requiredPatterns: ["requestId", "log.info", "log.error"],
  },
  {
    file: "app/api/transcribe/route.ts",
    requiredPatterns: ["requestId", "log.error"],
  },
  {
    file: "app/api/tts/route.ts",
    requiredPatterns: ["requestId", "log.error"],
  },
  {
    file: "app/test/external-tool-conversation/page.tsx",
    requiredPatterns: ["log.error", "log.warn"],
  },
  {
    file: "server/db-scripts/add-default-scoring-configs.ts",
    requiredPatterns: ["runId", "log.info", "log.error"],
  },
  {
    file: "server/db-scripts/backfill-final-scores.ts",
    requiredPatterns: ["runId", "log.info", "log.error"],
  },
  {
    file: "shared/services/backgroundInterview/useAnnouncementGeneration.ts",
    requiredPatterns: ["requestId", "log.info", "log.error"],
  },
  {
    file: "shared/services/backgroundInterview/useBackgroundPreload.ts",
    requiredPatterns: ["preloadId", "log.info", "log.error"],
  },
  {
    file: "shared/services/backgroundInterview/useSoundPreload.ts",
    requiredPatterns: ["preloadId", "log.info", "log.error"],
  },
];

describe("observability logging replacements", () => {
  it("removes console usage and keeps correlation context", () => {
    for (const entry of filesWithContext) {
      const filePath = path.join(process.cwd(), entry.file);
      const content = fs.readFileSync(filePath, "utf8");
      expect(content).not.toMatch(/\bconsole\./);
      for (const pattern of entry.requiredPatterns) {
        expect(content).toContain(pattern);
      }
    }
  });
});
