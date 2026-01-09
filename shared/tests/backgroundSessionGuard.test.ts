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
    let gs: GuardState = {};
    gs = ensureTimerStarted(gs, t0);
    expect(elapsedMs(gs, t0)).toBe(0);

    setNow(t0 + TIMEBOX_MS - 1);
    expect(shouldTransition(gs, { clockMs: t0 + TIMEBOX_MS - 1 })).toBeNull();

    setNow(t0 + TIMEBOX_MS);
    expect(shouldTransition(gs, { clockMs: t0 + TIMEBOX_MS })).toBe("timebox");
  });
});


