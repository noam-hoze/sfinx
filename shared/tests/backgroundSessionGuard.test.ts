import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  TIMEBOX_MS,
  ensureTimerStarted,
  elapsedMs,
  shouldTransition,
  GuardState,
} from "../services/backgroundSessionGuard";
import { interviewChatStore } from "../state/interviewChatStore";

function setNow(ms: number) {
  vi.setSystemTime(ms);
}

describe("backgroundSessionGuard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // reset store
    const s = interviewChatStore.getState();
    interviewChatStore.dispatch({ type: "CLEAR" });
    // clear background fields by reinitializing via internal reducer defaults
    const init = {
      confidence: 0,
      questionsAsked: 0,
      transitioned: false,
    } as any;
    (interviewChatStore as any).dispatch({
      type: "SET_STAGE",
      payload: s.stage,
    });
    // Manually restore background minimal defaults
    (interviewChatStore as any).getState().background = init;
  });

  it("Timebox: should transition when elapsed >= TIMEBOX_MS", () => {
    const t0 = 1_000_000;
    setNow(t0);
    let gs: GuardState = { consecutiveUselessAnswers: 0 };
    gs = ensureTimerStarted(gs, t0);
    expect(elapsedMs(gs, t0)).toBe(0);

    setNow(t0 + TIMEBOX_MS - 1);
    expect(shouldTransition(gs, { gateReady: false, clockMs: t0 + TIMEBOX_MS - 1 })).toBeNull();

    setNow(t0 + TIMEBOX_MS);
    expect(shouldTransition(gs, { gateReady: false, clockMs: t0 + TIMEBOX_MS })).toBe("timebox");
  });

  it("Useless answers: triggers when consecutiveUselessAnswers >= 2 (gate false, not timebox)", () => {
    const t0 = 2_000_000;
    setNow(t0);
    const gs: GuardState = { startedAtMs: t0, consecutiveUselessAnswers: 2 };
    // before timebox expires
    expect(shouldTransition(gs, { gateReady: false, clockMs: t0 + 1000 })).toBe("useless_answers");
  });

  it("Consecutive useless answers counter increments on 0/0/0 and resets on non-zero", () => {
    // Simulate two consecutive zero triplets
    interviewChatStore.dispatch({
      type: "BG_ACCUMULATE_CONTROL_RESULT",
      payload: { pillars: { adaptability: 0, creativity: 0, reasoning: 0 } },
    });
    expect(interviewChatStore.getState().background.consecutiveUselessAnswers).toBe(1);

    interviewChatStore.dispatch({
      type: "BG_ACCUMULATE_CONTROL_RESULT",
      payload: { pillars: { adaptability: 0, creativity: 0, reasoning: 0 } },
    });
    expect(interviewChatStore.getState().background.consecutiveUselessAnswers).toBe(2);

    // Non-zero should reset
    interviewChatStore.dispatch({
      type: "BG_ACCUMULATE_CONTROL_RESULT",
      payload: { pillars: { adaptability: 10, creativity: 0, reasoning: 0 } },
    });
    expect(interviewChatStore.getState().background.consecutiveUselessAnswers).toBe(0);
  });

  it("consecutiveUselessAnswers initializes to 0 on background start timer", () => {
    interviewChatStore.dispatch({ type: "BG_GUARD_START_TIMER" });
    expect(interviewChatStore.getState().background.consecutiveUselessAnswers).toBe(0);
  });
});


