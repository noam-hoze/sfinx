import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test('Background via voice → CONTROL non-zero and projectsUsed 0→1', async ({ page, context, baseURL }) => {
  test.setTimeout(20_000);
  const logLines: string[] = [];
  const outPath = test.info().outputPath('interview.e2e.log');
  const stableDir = path.resolve(process.cwd(), 'test-results');
  const stablePath = path.join(stableDir, 'latest-e2e.log');
  const push = (m: string) => logLines.push(`[${new Date().toISOString()}] ${m}`);
  page.on('console', (msg) => push(`[console:${msg.type()}] ${msg.text()}`));
  const origin = baseURL || 'http://localhost:3000';
  await context.grantPermissions(['microphone'], { origin });

  // 1) Login
  await page.goto('/login');
  await page.getByPlaceholder('Enter your email').fill('gal@gmail.com');
  await page.getByPlaceholder('Enter your password').fill('sfinx');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForLoadState('networkidle');

  // 2) Navigate directly to interview and start
  await page.goto('/interview?companyId=meta&jobId=meta-frontend-engineer');
  await page.getByRole('button', { name: 'Start Interview' }).click();

  // Confirm mic stream engaged before proceeding (diagnose permission/fake mic)
  await page.waitForFunction(() => {
    const s = (window as any).__sfinxStore?.getState?.();
    const rec = Boolean(s?.interviewChat?.isRecording);
    if (rec) console.log('[store] isRecording=true');
    return rec;
  }, { timeout: 10000 });

  // Subscribe to store changes (stage, projectsUsed, pillars)
  await page.evaluate(() => {
    try {
      const s = (window as any).__sfinxStore;
      if (!s || !s.getState || !s.subscribe) return;
      let lastStage: any;
      let lastProjects = -1;
      let lastRecording: any;
      let lastMsgCount = -1;
      s.subscribe(() => {
        const st = s.getState();
        const stage = st.stage;
        const bg = st.background || {};
        const chat = st.interviewChat || { messages: [], isRecording: false };
        const p = bg.pillars || {};
        // eslint-disable-next-line no-console
        if (stage !== lastStage) console.log(`[store] stage=${stage}`);
        if (bg.projectsUsed !== lastProjects) console.log(`[store] projectsUsed=${bg.projectsUsed}`);
        if (chat.isRecording !== lastRecording) console.log(`[store] isRecording=${chat.isRecording}`);
        if (chat.messages.length !== lastMsgCount) {
          const m = chat.messages[chat.messages.length - 1];
          if (m) console.log(`[chat] ${m.speaker}: ${m.text}`);
        }
        console.log(`[store] pillars A:${p.adaptability ?? 0} C:${p.creativity ?? 0} R:${p.reasoning ?? 0}`);
        lastStage = stage;
        lastProjects = bg.projectsUsed;
        lastRecording = chat.isRecording;
        lastMsgCount = chat.messages.length;
      });
    } catch {}
  });

  // 3) Wait until we enter Background stage in our store
  await page.waitForFunction(() => {
    const s = (window as any).__sfinxStore?.getState?.();
    return s && s.stage === 'background';
  }, { timeout: 10000 });

  // Assert starts at 0
  const startProjects = await page.evaluate(() => {
    const s = (window as any).__sfinxStore.getState();
    return Number(s.background.projectsUsed || 0);
  });
  expect(startProjects).toBe(0);

  // Ensure at least one user transcript message arrives (diagnose mic/path)
  await page.waitForFunction(() => {
    const s = (window as any).__sfinxStore?.getState?.();
    const msgs = s?.interviewChat?.messages || [];
    return msgs.some((m: any) => m.speaker === 'user' && String(m.text || '').trim().length > 0);
  }, { timeout: 10000 });

  // 4) Wait for CONTROL to produce pillars with any non-zero (≤5s)
  const pillars = await page.waitForFunction(() => {
    const s = (window as any).__sfinxStore?.getState?.();
    const p = s?.background?.pillars;
    if (!p) return null;
    const a = Number(p.adaptability || 0);
    const c = Number(p.creativity || 0);
    const r = Number(p.reasoning || 0);
    return (a > 0 || c > 0 || r > 0) ? { a, c, r } : null;
  }, { timeout: 10000 });

  const value = await pillars.jsonValue() as { a: number, c: number, r: number };
  // Log per spec
  // eslint-disable-next-line no-console
  console.log('[e2e] CONTROL pillars:', value);
  expect(value.a > 0 || value.c > 0 || value.r > 0).toBe(true);

  // 5) projectsUsed should now be 1
  await page.waitForFunction(() => {
    const s = (window as any).__sfinxStore?.getState?.();
    return Number(s?.background?.projectsUsed || 0) === 1;
  }, { timeout: 20000 });

  // Flush logs to file
  try {
    fs.writeFileSync(outPath, logLines.join('\n'), 'utf8');
    try { fs.mkdirSync(stableDir, { recursive: true }); } catch {}
    fs.writeFileSync(stablePath, logLines.join('\n'), 'utf8');
  } catch {}
});


