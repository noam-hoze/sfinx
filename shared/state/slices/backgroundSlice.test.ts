/**
 * Unit tests for backgroundSlice
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import backgroundReducer, {
  addMessage,
  clear,
  resetAll,
  startTimer,
  setTimebox,
  type BackgroundState,
  type ChatMessage,
} from "./backgroundSlice";
import { resetInterview } from "./interviewSlice";

describe("backgroundSlice", () => {
  const initialState: BackgroundState = {
    messages: [],
    transitioned: false,
    evaluatingAnswer: false,
    currentFocusTopic: null,
    currentQuestionTarget: null,
    categoryStats: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("reducers", () => {
    it("should return initial state", () => {
      const state = backgroundReducer(undefined, { type: "@@INIT" });
      expect(state).toEqual(initialState);
    });

    it("should handle addMessage for user", () => {
      const state = backgroundReducer(
        initialState,
        addMessage({ text: "Hello", speaker: "user" })
      );
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].text).toBe("Hello");
      expect(state.messages[0].speaker).toBe("user");
      expect(state.messages[0].id).toBeDefined();
      expect(state.messages[0].timestamp).toBeGreaterThan(0);
    });

    it("should handle addMessage for ai", () => {
      const state = backgroundReducer(
        initialState,
        addMessage({ text: "Hi there", speaker: "ai" })
      );
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].speaker).toBe("ai");
    });

    it("should add multiple messages", () => {
      let state = backgroundReducer(
        initialState,
        addMessage({ text: "msg1", speaker: "user" })
      );
      state = backgroundReducer(
        state,
        addMessage({ text: "msg2", speaker: "ai" })
      );
      expect(state.messages).toHaveLength(2);
      expect(state.messages[0].text).toBe("msg1");
      expect(state.messages[1].text).toBe("msg2");
    });

    it("should handle clear action", () => {
      const stateWithMessages: BackgroundState = {
        ...initialState,
        messages: [
          { id: "1", text: "test", speaker: "user", timestamp: 123 },
        ],
      };
      const state = backgroundReducer(stateWithMessages, clear());
      expect(state.messages).toHaveLength(0);
    });

    it("should handle resetAll action", () => {
      const populatedState: BackgroundState = {
        messages: [
          { id: "1", text: "test", speaker: "user", timestamp: 123 },
        ],
        transitioned: true,
        evaluatingAnswer: true,
        currentFocusTopic: "topic1",
        currentQuestionTarget: { question: "q1", category: "cat1" },
        categoryStats: [
          { categoryName: "cat1", count: 1, avgStrength: 50, dontKnowCount: 0 },
        ],
      };
      const state = backgroundReducer(populatedState, resetAll());
      expect(state).toEqual(initialState);
    });

    it("should handle startTimer", () => {
      const before = Date.now();
      const state = backgroundReducer(initialState, startTimer());
      const after = Date.now();
      expect(state.startedAtMs).toBeDefined();
      expect(state.startedAtMs!).toBeGreaterThanOrEqual(before);
      expect(state.startedAtMs!).toBeLessThanOrEqual(after);
    });

    it("should not restart timer if already started", () => {
      const stateWithTimer = {
        ...initialState,
        startedAtMs: 1000,
      };
      const state = backgroundReducer(stateWithTimer, startTimer());
      expect(state.startedAtMs).toBe(1000);
    });

    it("should handle setTimebox with valid value", () => {
      const state = backgroundReducer(
        initialState,
        setTimebox({ timeboxMs: 5000 })
      );
      expect(state.timeboxMs).toBe(5000);
    });

    it("should handle setTimebox with undefined", () => {
      const state = backgroundReducer(
        initialState,
        setTimebox({ timeboxMs: undefined })
      );
      expect(state.timeboxMs).toBeUndefined();
    });

    it("should reject invalid timebox values", () => {
      let state = backgroundReducer(
        initialState,
        setTimebox({ timeboxMs: -100 })
      );
      expect(state.timeboxMs).toBeUndefined();

      state = backgroundReducer(
        initialState,
        setTimebox({ timeboxMs: 0 })
      );
      expect(state.timeboxMs).toBeUndefined();

      state = backgroundReducer(
        initialState,
        setTimebox({ timeboxMs: Infinity })
      );
      expect(state.timeboxMs).toBeUndefined();
    });

    it("should handle resetInterview global action", () => {
      const populatedState: BackgroundState = {
        messages: [{ id: "1", text: "test", speaker: "user", timestamp: 123 }],
        transitioned: true,
        evaluatingAnswer: true,
        currentFocusTopic: "topic1",
        currentQuestionTarget: null,
        categoryStats: [],
      };
      const state = backgroundReducer(populatedState, resetInterview());
      expect(state).toEqual(initialState);
    });
  });
});
