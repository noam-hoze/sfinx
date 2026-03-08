/**
 * Full interview E2E flow — single sequential test per profile.
 * Stages: background → coding → CPS verification.
 * Uses the debug "End" button to skip the background timer (NEXT_PUBLIC_DEBUG_MODE=true required).
 */
import { test, expect } from "@playwright/test";
import { loginAsCandidate, loginAsCompany } from "./helpers/auth";
import {
  navigateToInterview,
  startInterview,
  answerQuestion,
  forceCompleteBackground,
  waitForBackgroundComplete,
} from "./helpers/background";
import { startCodingStage, runCodingStage } from "./helpers/coding";
import {
  getSessionId,
  verifyBackgroundResults,
  verifyCodingResults,
  verifyCPSPage,
} from "./helpers/assertions";
import { strongCandidate } from "./profiles/strongCandidate";
import type { CandidateProfile } from "./profiles/types";

const profiles: CandidateProfile[] = [strongCandidate];

for (const profile of profiles) {
  test(`full interview flow — ${profile.name}`, async ({ page }) => {
    test.setTimeout(600_000);

    let sessionId: string;

    await test.step("background stage", async () => {
      await loginAsCandidate(page);
      await navigateToInterview(page);
      await startInterview(page);

      await answerQuestion(page, profile.backgroundAnswers[0]);

      await forceCompleteBackground(page);
      await waitForBackgroundComplete(page);

      sessionId = await getSessionId(page);
      expect(sessionId).toBeTruthy();
    });

    await test.step("coding stage", async () => {
      await startCodingStage(page);
      await runCodingStage(page, profile);
    });

    await test.step("verify coding results", async () => {
      await verifyCodingResults(page, sessionId!, profile);
    });

    await test.step("CPS verification", async () => {
      const candidateName = process.env.E2E_CANDIDATE_NAME;
      if (!candidateName) throw new Error("E2E_CANDIDATE_NAME not set");

      await loginAsCompany(page);
      await page.goto("/company-dashboard");

      // Wait for the applicants table and click the candidate row by name
      await page.getByText(candidateName).first().waitFor({ state: "visible", timeout: 30_000 });
      await page.getByText(candidateName).first().click();

      // Wait for navigation to CPS page
      await page.waitForURL((url) => url.pathname.includes("/cps"), { timeout: 15_000 });

      // CPS page triggers background-summary generation — verify after page loads
      await verifyCPSPage(page, profile);
      await verifyBackgroundResults(page, sessionId!, profile);
    });
  });
}
