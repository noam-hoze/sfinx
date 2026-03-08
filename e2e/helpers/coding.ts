/**
 * Coding stage helpers.
 * Types code, pastes code (triggering ExternalToolUsage), and starts the coding phase.
 */
import { type Page } from "@playwright/test";
import type { CandidateProfile } from "../profiles/types";

const DEBUG_INGEST = 'http://127.0.0.1:7244/ingest/a7a962d3-a365-4cdf-9479-10209a61a26e';
const DEBUG_HEADERS = { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '08ebcb' };

async function debugLog(location: string, message: string, data: Record<string, unknown>) {
  await fetch(DEBUG_INGEST, { method: 'POST', headers: DEBUG_HEADERS, body: JSON.stringify({ sessionId: '08ebcb', location, message, data, timestamp: Date.now(), hypothesisId: 'H-TIMING' }) }).catch(() => {});
}

/** Clicks the "Start Coding Challenge" button on the completion screen to enter the IDE. */
export async function startCodingStage(page: Page) {
  const btn = page.getByRole("button", { name: /start coding/i });
  await btn.waitFor({ state: "visible", timeout: 15_000 });
  await btn.click();
  // #region agent log
  await debugLog('coding.ts:startCodingStage', 'Clicked Start Coding Challenge, waiting for Monaco', { ts: Date.now() });
  // #endregion

  await page.waitForSelector(".monaco-editor", { timeout: 30_000 });
  // #region agent log
  await debugLog('coding.ts:startCodingStage', 'Monaco selector resolved - editor in DOM', { ts: Date.now() });
  // #endregion

  // Wait for isCodingStarted=true — Submit button only renders when coding is active (automatic mode)
  await page.getByRole("button", { name: /submit/i }).waitFor({ state: "visible", timeout: 30_000 });
  // #region agent log
  await debugLog('coding.ts:startCodingStage', 'Submit button visible - isCodingStarted is true, editor is editable', { ts: Date.now() });
  // #endregion
}

/**
 * Types code into the Monaco editor character-by-character.
 * Uses keyboard events so Monaco registers the changes.
 */
export async function typeInEditor(page: Page, code: string) {
  // #region agent log
  await debugLog('coding.ts:typeInEditor', 'About to click editor and start typing', { codeLength: code.length, ts: Date.now() });
  // #endregion
  const editor = page.locator(".monaco-editor .view-lines");
  await editor.click();
  // #region agent log
  await debugLog('coding.ts:typeInEditor', 'Editor clicked - starting keyboard.type', { ts: Date.now() });
  // #endregion
  await page.keyboard.type(code, { delay: 10 });
  // #region agent log
  await debugLog('coding.ts:typeInEditor', 'keyboard.type finished', { codeLength: code.length, ts: Date.now() });
  // #endregion
}

/**
 * Replaces all editor content with the pasted code.
 * Selects all existing code, deletes it, then pastes — triggers Monaco's onDidPaste.
 */
export async function pasteInEditor(page: Page, code: string) {
  const editor = page.locator(".monaco-editor .view-lines");
  await editor.click();

  const modifier = process.platform === "darwin" ? "Meta" : "Control";
  await page.keyboard.press(`${modifier}+a`);
  await page.keyboard.press("Delete");

  await page.evaluate((text) => navigator.clipboard.writeText(text), code);
  await page.keyboard.press(`${modifier}+v`);
}

/** Runs the full coding stage: types code, waits for typing evaluation to complete, then pastes. */
export async function runCodingStage(page: Page, profile: CandidateProfile) {
  await typeInEditor(page, profile.codeToType);

  // Wait for the typing evaluation API response to complete before pasting.
  // The sentinel data-count attribute increments on each evaluate-code-change response.
  // This guarantees previousCode state is updated and syntax check has run.
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="eval-completed"]');
      return el && parseInt(el.getAttribute("data-count") ?? "0", 10) > 0;
    },
    { timeout: 30_000 }
  );

  await pasteInEditor(page, profile.codeToPaste);
  await page.waitForTimeout(10_000);
}
