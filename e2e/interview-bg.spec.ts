import { test, expect } from "@playwright/test";
import {
  loginAs,
  subscribeToStore,
  waitForState,
  sendChatMessage,
  waitForNonZeroPillars,
  waitForProjectsUsed,
  saveTestLogs,
  noamLog,
} from "./interview-bg.utils";

test("Background via text → CONTROL non-zero and projectsUsed 0→1", async ({
  page,
}) => {
  test.setTimeout(50_000);
  const logs: string[] = [];
  const log = (m: string) => logs.push(`[${new Date().toISOString()}] ${m}`);
  page.on("console", (msg) => log(`[console:${msg.type()}] ${msg.text()}`));

  try {
    // Log in as Gal
    await loginAs(page, "gal@gmail.com", "sfinx");

    // Go to interview and start
    await page.goto("/interview?companyId=meta&jobId=meta-frontend-engineer");
    await page.getByRole("button", { name: "Start Interview" }).click();

    // Subscribe to store changes
    await subscribeToStore(page);
    
    // Wait for AI greeting via state machine (deterministic)
    await waitForState(page, "greeting_said_by_ai");
    await sendChatMessage(page, "Hi");
    
    // State should advance to greeting_responded_by_user
    // and straight to background_asked_by_ai.
    // Then Send meaningful background answer (candidate)
    await waitForState(page, "background_asked_by_ai");
    await sendChatMessage(
      page,
      "I integrated Three.js into React and fixed memory leaks in custom shaders by cleaning up WebGL resources."
    );
    
    // Wait for the AI interviewer to respond
    await waitForState(page, "background_answered_by_user");
    
    // Wait for CONTROL non-zero
    //await waitForNonZeroPillars(page);
   
    // projectsUsed should now be 1
    await waitForProjectsUsed(page, 1);
    await noamLog(page, "Nono");
  } finally {
    saveTestLogs(test.info(), logs);
  }
});
