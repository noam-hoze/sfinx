/**
 * Profile-driven assertion helpers for verifying interview results.
 * All API calls use page.request to share the browser's authenticated session cookies.
 */
import { type Page, expect } from "@playwright/test";
import type { CandidateProfile } from "../profiles/types";

/**
 * Reads the interview session ID from the data-session-id attribute on the
 * background-complete element, which is set by the interview page on completion.
 */
export async function getSessionId(page: Page): Promise<string> {
  const sessionId = await page
    .getByTestId("background-complete")
    .getAttribute("data-session-id");

  if (sessionId) return sessionId;
  throw new Error("Could not extract session ID from background-complete element");
}

/**
 * Polls an API endpoint until it returns 200 or the timeout is exceeded.
 * Needed for async operations like background-summary generation.
 */
async function pollUntilOk(
  page: Page,
  url: string,
  timeoutMs = 60_000,
  intervalMs = 3_000
): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await page.request.get(url);
    if (res.ok()) return res.json();
    await page.waitForTimeout(intervalMs);
  }
  throw new Error(`Timed out waiting for ${url} to return 200`);
}

/** Verifies background stage results against the profile expectations. */
export async function verifyBackgroundResults(
  page: Page,
  sessionId: string,
  profile: CandidateProfile
) {
  const base = `/api/interviews/session/${sessionId}`;

  if (profile.expectSummaryContent) {
    const summary = await pollUntilOk(page, `${base}/background-summary`, 90_000);
    expect(summary.executiveSummary).toBeTruthy();
  }

  if (profile.expectEvidenceClips) {
    const evidence = await pollUntilOk(page, `${base}/background-evidence`);
    expect(evidence.length).toBeGreaterThan(0);
  }
}

/**
 * Polls GET /contributions until at least one coding contribution (codeChange !== "")
 * exists. Needed because evaluate-code-change is async and may still be in-flight.
 */
async function pollUntilCodingContributions(
  page: Page,
  url: string,
  timeoutMs = 90_000,
  intervalMs = 4_000
): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await page.request.get(url);
    if (res.ok()) {
      const data = await res.json();
      const coding = data.contributions?.filter((c: any) => c.codeChange !== "");
      if (coding?.length > 0) return data;
    }
    await page.waitForTimeout(intervalMs);
  }
  throw new Error(`Timed out waiting for coding contributions at ${url}`);
}

/** Verifies coding stage CategoryContribution records for structure and validity. */
async function verifyCodingContributions(
  page: Page,
  sessionId: string,
  profile: CandidateProfile
) {
  const data = await pollUntilCodingContributions(
    page,
    `/api/interviews/session/${sessionId}/contributions`,
    30_000
  );

  expect(data.contributions.length).toBeGreaterThan(0);
  expect(data.categoryStats.length).toBeGreaterThan(0);

  const codingContributions = data.contributions.filter((c: any) => c.codeChange !== "");
  expect(codingContributions.length).toBeGreaterThan(0);

  for (const c of data.contributions) {
    expect(c.categoryName).toBeTruthy();
    expect(c.contributionStrength).toBeGreaterThan(0);
    expect(c.explanation).toBeTruthy();
    expect(c.caption).toBeTruthy();
  }

  for (const c of codingContributions) {
    expect(c.codeChange).toBeTruthy();
  }

  for (const stat of data.categoryStats) {
    expect(stat.categoryName).toBeTruthy();
    expect(stat.confidence).toBeGreaterThanOrEqual(0);
    expect(stat.confidence).toBeLessThanOrEqual(1);
    expect(stat.avgStrength).toBeGreaterThanOrEqual(0);
  }
}

/** Verifies coding stage results against the profile expectations. */
export async function verifyCodingResults(
  page: Page,
  sessionId: string,
  profile: CandidateProfile
) {
  if (profile.expectCodingContributions) {
    await verifyCodingContributions(page, sessionId, profile);
  }

  if (profile.expectExternalToolUsage) {
    const tools = await pollUntilOk(
      page,
      `/api/interviews/session/${sessionId}/external-tools`,
      60_000
    );
    expect(tools.length).toBeGreaterThan(0);
  }
}

/** Verifies the CPS page displays correct data for the profile. */
export async function verifyCPSPage(page: Page, profile: CandidateProfile) {
  await page.getByTestId("cps-page").waitFor({ state: "visible", timeout: 30_000 });

  if (profile.expectPositiveScore) {
    const scoreEl = page.getByTestId("cps-overall-score");
    await scoreEl.waitFor({ state: "visible", timeout: 30_000 });
    const scoreText = await scoreEl.textContent();
    const score = parseInt(scoreText || "0", 10);
    expect(score).toBeGreaterThan(0);
  }

  if (profile.expectSummaryContent) {
    const storyEl = page.getByTestId("cps-candidate-story");
    await storyEl.waitFor({ state: "visible", timeout: 30_000 });
    const storyText = await storyEl.textContent();
    expect(storyText?.length).toBeGreaterThan(10);
  }

  if (profile.expectEvidenceClips) {
    await page.getByTestId("cps-evidence-reel").waitFor({ state: "visible", timeout: 30_000 });
  }

  if (profile.expectContributions) {
    await page.getByTestId("cps-experience-section").waitFor({ state: "visible", timeout: 30_000 });
  }
}
