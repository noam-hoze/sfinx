/**
 * Defines the behavior and expectations for a candidate persona in E2E tests.
 * Each profile drives both test actions (what to type/paste) and assertions (what to verify).
 */
export interface CandidateProfile {
  name: string;
  backgroundAnswers: string[];
  expectContributions: boolean;
  expectEvidenceClips: boolean;
  expectSummaryContent: boolean;
  expectPositiveScore: boolean;
  codeToType: string;
  codeToPaste: string;
  expectExternalToolUsage: boolean;
  expectCodingContributions: boolean;
}
