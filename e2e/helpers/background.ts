/**
 * Background interview stage helpers.
 * Drives the question-answer loop based on a CandidateProfile.
 */
import { type Page } from "@playwright/test";
import type { CandidateProfile } from "../profiles/types";

/** Navigates to the interview page for the configured test company/job. */
export async function navigateToInterview(page: Page) {
  const companyId = process.env.E2E_COMPANY_ID;
  const jobId = process.env.E2E_JOB_ID;
  if (!companyId || !jobId) throw new Error("E2E_COMPANY_ID/JOB_ID not set");
  await page.goto(`/interview?companyId=${companyId}&jobId=${jobId}`);
}

/** Waits for the PreInterviewScreen start button and clicks it. */
export async function startInterview(page: Page) {
  const startBtn = page.getByRole("button", { name: /start/i });
  await startBtn.waitFor({ state: "visible", timeout: 30_000 });
  await startBtn.click();
}

/** Waits for the question card, expands text input, fills answer, and submits. */
export async function answerQuestion(page: Page, answerText: string) {
  await page.getByTestId("question-text").waitFor({ state: "visible", timeout: 60_000 });

  const toggleBtn = page.getByTestId("toggle-text-input");
  await toggleBtn.waitFor({ state: "visible", timeout: 10_000 });
  await toggleBtn.click();

  const input = page.getByTestId("answer-input");
  await input.waitFor({ state: "visible", timeout: 5_000 });
  await input.fill(answerText);

  await page.getByTestId("submit-answer-btn").click();
}

/**
 * Forces the background stage to end immediately using the debug "End" button.
 * Requires NEXT_PUBLIC_DEBUG_MODE=true. The debug panel is open by default.
 */
export async function forceCompleteBackground(page: Page) {
  const endBtn = page.getByTestId("force-complete-background");
  await endBtn.scrollIntoViewIfNeeded();
  await endBtn.waitFor({ state: "visible", timeout: 30_000 });
  await endBtn.click();
}

/** Runs N background answers from the profile without forcing completion. */
export async function runBackgroundStage(page: Page, profile: CandidateProfile, count?: number) {
  const answers = profile.backgroundAnswers.slice(0, count ?? profile.backgroundAnswers.length);
  for (let i = 0; i < answers.length; i++) {
    await answerQuestion(page, answers[i]);
    if (i < answers.length - 1) await page.waitForTimeout(2_000);
  }
}

/** Waits for the background completion screen to appear. */
export async function waitForBackgroundComplete(page: Page) {
  await page.getByTestId("background-complete").waitFor({
    state: "visible",
    timeout: 120_000,
  });
}
