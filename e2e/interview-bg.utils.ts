import { expect } from "@playwright/test";
import fs from "fs";
import path from "path";

export async function loginAs(page: any, email: string, password: string) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const emailInput = page.getByTestId("login-email");
  const passInput = page.getByTestId("login-password");
  await emailInput.fill(email);
  await passInput.fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForLoadState("networkidle");
}

export async function subscribeToStore(page: any) {
  await page.evaluate(() => {
    const s = (window as any).__sfinxStore;
    if (!s || !s.getState || !s.subscribe) return;
    let lastStage: any;
    s.subscribe(() => {
      const st = s.getState();
      const stage = st.stage;
      // eslint-disable-next-line no-console
      if (stage !== lastStage) console.log(`[store] stage=${stage}`);
      const pillars = st.background?.pillars;
      if (!pillars) {
        lastStage = stage;
        return;
      }
      const { adaptability, creativity, reasoning } = pillars;
      if (
        adaptability === undefined ||
        creativity === undefined ||
        reasoning === undefined
      ) {
        throw new Error("Missing pillar score in background store");
      }
      console.log(
        `[store] pillars A:${adaptability} C:${creativity} R:${reasoning}`
      );
      lastStage = stage;
    });
  });
}

export async function waitForState(page: any, state: string, timeout = 10000) {
  await page.waitForFunction(
    (targetState: string) => {
      const st = (window as any).__sfinxStore?.getState?.();
      return st && st.interviewMachine?.state === targetState;
    },
    state,
    { timeout }
  );
}

export async function sendChatMessage(page: any, message: string) {
  const input = page.locator('input[name="chat_input"]');
  await input.waitFor({ timeout: 10000 });
  await input.click();
  await input.fill(message);
  await input.press("Enter");

  // // Verify the message was recorded in chat
  // await page.waitForFunction(
  //   (expected: string) => {
  //     const msgs =
  //       (window as any).__sfinxStore?.getState?.()?.interviewChat?.messages ||
  //       [];
  //     const last = msgs[msgs.length - 1];
  //     return (
  //       last &&
  //       last.speaker === "user" &&
  //       String(last.text).trim() === expected
  //     );
  //   },
  //   message,
  //   { timeout: 10000 }
  // );
}

export async function logDomValue(page: any, selector: string, label = "dom") {
  await page.evaluate(
    (sel: string, logLabel: string) => {
      const el = document.querySelector(sel) as HTMLInputElement | null;
      // eslint-disable-next-line no-console
      if (!el?.value) {
        throw new Error(`Element ${sel} has no value to log`);
      }
      console.log(
        `[${logLabel}] input value after fill`,
        el.value
      );
    },
    selector,
    label
  );
}

export async function noamLog(page: any, message: any) {
  await page.evaluate((msg: any) => {
    // eslint-disable-next-line no-console
    console.log(msg);
  }, message);
}

export async function waitForNonZeroPillars(page: any, timeout = 10000) {
  const pillars = await page.waitForFunction(
    () => {
      const s = (window as any).__sfinxStore?.getState?.();
      const p = s?.background?.pillars;
      if (!p) return null;
      const { adaptability, creativity, reasoning } = p;
      if (
        adaptability === undefined ||
        creativity === undefined ||
        reasoning === undefined
      ) {
        throw new Error("Pillar score missing");
      }
      const a = Number(adaptability);
      const c = Number(creativity);
      const r = Number(reasoning);
      if (Number.isNaN(a) || Number.isNaN(c) || Number.isNaN(r)) {
        throw new Error("Pillar score is not numeric");
      }
      return a > 0 || c > 0 || r > 0 ? { a, c, r } : null;
    },
    { timeout }
  );

  const v = (await pillars.jsonValue()) as {
    a: number;
    c: number;
    r: number;
  };
  // eslint-disable-next-line no-console
  console.log("[e2e] CONTROL pillars:", v);
  expect(v.a > 0 || v.c > 0 || v.r > 0).toBe(true);

  return v;
}

export async function waitForProjectsUsed(
  page: any,
  expectedCount: number,
  timeout = 10000
) {
  await page.waitForFunction(
    (count: number) => {
      const projectsUsed = (window as any).__sfinxChatStore?.getState?.()
        ?.background?.projectsUsed;
      console.log("The projects that are used is:", projectsUsed);
      return Number(projectsUsed) === count;
    },
    expectedCount,
    { timeout }
  );
}

export function saveTestLogs(testInfo: any, logs: string[]) {
  try {
    const outPath = testInfo.outputPath("interview.e2e.log");
    fs.writeFileSync(outPath, logs.join("\n"), "utf8");
    const stableDir = path.resolve(process.cwd(), "test-results");
    const stablePath = path.join(stableDir, "latest-e2e.log");
    try {
      fs.mkdirSync(stableDir, { recursive: true });
    } catch {}
    fs.writeFileSync(stablePath, logs.join("\n"), "utf8");
  } catch {}
}
