import { describe, it, expect, beforeEach, vi } from "vitest";
import { store } from "../state/store";
import {
  start,
  aiFinal,
  userFinal,
  setExpectedBackgroundQuestion,
} from "../state/slices/interviewMachineSlice";
import { interviewChatStore } from "../state/interviewChatStore";
import { TIMEBOX_MS } from "../services/backgroundSessionGuard";
import { requestControlDeltaOnly } from "./utils/openAIControl";

function setNow(ms: number) {
  vi.setSystemTime(ms);
}

function greetingFor(name?: string) {
  const n = name || "Candidate";
  return `Hi ${n}, I'm Carrie. I'll be the one interviewing today!`;
}

describe("Interview flow – background guard integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // reset redux slice
    store.dispatch({ type: "interviewMachine/reset" } as any);
    // reset chat store
    (interviewChatStore as any).dispatch({ type: "CLEAR" });
    const init = {
      confidence: 0,
      questionsAsked: 0,
      transitioned: false,
    } as any;
    (interviewChatStore as any).getState().background = init;
  });

  it("zeroRuns increments on 0/0/0 and projectsUsed starts at 1 in background (OpenAI)", async () => {
    // Arrange: enter background
    store.dispatch(start({ candidateName: "Gal" }));
    store.dispatch(aiFinal({ text: greetingFor("Gal") }));
    store.dispatch(userFinal());
    store.dispatch(setExpectedBackgroundQuestion({ question: "Tell me about X" }));
    store.dispatch(aiFinal({ text: "Tell me about X" })); // -> background_asked_by_ai + timer
    store.dispatch(userFinal()); // -> background_answered_by_user

    expect(interviewChatStore.getState().background.projectsUsed).toBe(1);

    // First CONTROL via OpenAI: empty answer → expect 0/0/0
    const control1 = await requestControlDeltaOnly({
      company: "Meta",
      role: "frontend engineer",
      lastQ: "Tell me about a complex React integration you built. What made it challenging?",
      lastA: "I don't know.",
      timeoutMs: 5000,
    });
    interviewChatStore.dispatch({ type: "BG_ACCUMULATE_CONTROL_RESULT", payload: { pillars: control1.pillars } });
    expect(interviewChatStore.getState().background.zeroRuns).toBe(1);

    // Second CONTROL via OpenAI: empty again → expect 0/0/0
    const control2 = await requestControlDeltaOnly({
      company: "Meta",
      role: "frontend engineer",
      lastQ: "Tell me about a complex React integration you built. What made it challenging?",
      lastA: "I don't know.",
      timeoutMs: 5000,
    });
    interviewChatStore.dispatch({ type: "BG_ACCUMULATE_CONTROL_RESULT", payload: { pillars: control2.pillars } });
    expect(interviewChatStore.getState().background.zeroRuns).toBe(2);
  });

  it("timebox triggers coding after 4:00 (graceful path simulated)", () => {
    const t0 = 5_000_000;
    setNow(t0);
    store.dispatch(start({ candidateName: "Gal" }));
    store.dispatch(aiFinal({ text: greetingFor("Gal") }));
    store.dispatch(userFinal());
    store.dispatch(setExpectedBackgroundQuestion({ question: "Q?" }));
    store.dispatch(aiFinal({ text: "Q?" })); // enters background and starts timer
    store.dispatch(userFinal()); // -> background_answered_by_user

    // Advance to just before timebox
    setNow(t0 + TIMEBOX_MS - 1000);
    store.dispatch(aiFinal({ text: "follow-up" })); // still background, not yet expired
    expect(store.getState().interviewMachine.state).not.toBe("in_coding_session");

    // Advance beyond timebox; first mark user's turn done, then AI finishes
    setNow(t0 + TIMEBOX_MS + 1);
    store.dispatch(userFinal());
    store.dispatch(aiFinal({ text: "closing" }));
    expect(store.getState().interviewMachine.state).toBe("in_coding_session");
  });

  it("projectsUsed increments to 2 after project switch following two zero runs", () => {
    // Enter background
    store.dispatch(start({ candidateName: "Gal" }));
    store.dispatch(aiFinal({ text: greetingFor("Gal") }));
    store.dispatch(userFinal());
    store.dispatch(setExpectedBackgroundQuestion({ question: "Q?" }));
    store.dispatch(aiFinal({ text: "Q?" }));
    store.dispatch(userFinal());
    expect(interviewChatStore.getState().background.projectsUsed).toBe(1);

    // Two consecutive zero runs
    interviewChatStore.dispatch({
      type: "BG_ACCUMULATE_CONTROL_RESULT",
      payload: { pillars: { adaptability: 0, creativity: 0, reasoning: 0 } },
    });
    interviewChatStore.dispatch({
      type: "BG_ACCUMULATE_CONTROL_RESULT",
      payload: { pillars: { adaptability: 0, creativity: 0, reasoning: 0 } },
    });
    expect(interviewChatStore.getState().background.zeroRuns).toBe(2);

    // Simulate sending the "another project?" prompt by switching project
    interviewChatStore.dispatch({ type: "BG_GUARD_RESET_PROJECT" });
    const bg = interviewChatStore.getState().background;
    expect(bg.projectsUsed).toBe(2);
    expect(bg.zeroRuns).toBe(0);
  });

  it("one project cap: two consecutive zeros after a meaningful answer → coding (OpenAI)", async () => {
    // Enter background
    store.dispatch(start({ candidateName: "Gal" }));
    store.dispatch(aiFinal({ text: greetingFor("Gal") }));
    store.dispatch(userFinal());
    store.dispatch(setExpectedBackgroundQuestion({ question: "Describe a complex React integration." }));
    store.dispatch(aiFinal({ text: "Describe a complex React integration." }));
    store.dispatch(userFinal());
    // After first meaningful answer, we consider project 1 started
    // Depending on timing, projectsUsed may be 1 (if pendingProject logic increments here)
    // We only assert that zeros are counted after meaningful answer

    // Project 1: meaningful → non-zero
    const p1Ok = await requestControlDeltaOnly({
      company: "Meta",
      role: "frontend engineer",
      lastQ: "Describe a complex React integration.",
      lastA: "I integrated Three.js with React, profiled GPU with Chrome DevTools, and implemented explicit WebGL resource cleanup to fix shader memory leaks.",
      timeoutMs: 5000,
    });
    interviewChatStore.dispatch({ type: "BG_ACCUMULATE_CONTROL_RESULT", payload: { pillars: p1Ok.pillars } });
    expect(interviewChatStore.getState().background.zeroRuns || 0).toBe(0);

    // P1: zero #1
    const p1z1 = await requestControlDeltaOnly({
      company: "Meta",
      role: "frontend engineer",
      lastQ: "What was challenging?",
      lastA: "I don't know.",
      timeoutMs: 5000,
    });
    interviewChatStore.dispatch({ type: "BG_ACCUMULATE_CONTROL_RESULT", payload: { pillars: p1z1.pillars } });
    expect(interviewChatStore.getState().background.zeroRuns).toBe(1);

    // P1: zero #2
    const p1z2 = await requestControlDeltaOnly({
      company: "Meta",
      role: "frontend engineer",
      lastQ: "What else?",
      lastA: "No.",
      timeoutMs: 5000,
    });
    interviewChatStore.dispatch({ type: "BG_ACCUMULATE_CONTROL_RESULT", payload: { pillars: p1z2.pillars } });
    expect(interviewChatStore.getState().background.zeroRuns).toBe(2);

    // With the simplified rule: two consecutive zeros within the same project → cap
    // We already did two zeros above for project 1; the system should proceed to coding

    // Now transition to coding due to cap
    store.dispatch(userFinal());
    store.dispatch(aiFinal({ text: "closing" }));
    expect(store.getState().interviewMachine.state).toBe("in_coding_session");
    expect(interviewChatStore.getState().background.reason).toBe("projects_cap");
  });
});


