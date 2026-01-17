/**
 * Unit tests for codingSlice
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import codingReducer, {
  addMessage,
  clear,
  setPendingReply,
  setTimebox,
  startPasteEvaluation,
  incrementPasteAnswer,
  type CodingState,
} from "./codingSlice";
import { resetInterview } from "./interviewSlice";

// Mock crypto.randomUUID
Object.defineProperty(global.crypto, "randomUUID", {
  value: () => "test-uuid-" + Math.random(),
  writable: true,
});

describe("codingSlice", () => {
  const initialState: CodingState = {
    messages: [],
    pendingReply: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("reducers", () => {
    it("should return initial state", () => {
      const state = codingReducer(undefined, { type: "@@INIT" });
      expect(state).toEqual(initialState);
    });

    it("should handle addMessage for user", () => {
      const state = codingReducer(
        initialState,
        addMessage({ text: "Hello", speaker: "user" })
      );
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].text).toBe("Hello");
      expect(state.messages[0].speaker).toBe("user");
      expect(state.messages[0].id).toBeDefined();
      expect(state.messages[0].timestamp).toBeGreaterThan(0);
    });

    it("should handle addMessage with paste evaluation", () => {
      const state = codingReducer(
        initialState,
        addMessage({
          text: "Test",
          speaker: "ai",
          isPasteEval: true,
          pasteEvaluationId: "eval-123",
        })
      );
      expect(state.messages[0].isPasteEval).toBe(true);
      expect(state.messages[0].pasteEvaluationId).toBe("eval-123");
    });

    it("should handle clear action", () => {
      const stateWithMessages: CodingState = {
        ...initialState,
        messages: [
          {
            id: "1",
            text: "test",
            speaker: "user",
            timestamp: 123,
          },
        ],
      };
      const state = codingReducer(stateWithMessages, clear());
      expect(state.messages).toHaveLength(0);
    });

    it("should handle setPendingReply", () => {
      let state = codingReducer(
        initialState,
        setPendingReply({ pending: true })
      );
      expect(state.pendingReply).toBe(true);

      state = codingReducer(state, setPendingReply({ pending: false }));
      expect(state.pendingReply).toBe(false);
    });

    it("should handle setTimebox", () => {
      const state = codingReducer(
        initialState,
        setTimebox({ timeboxSeconds: 300 })
      );
      expect(state.timeboxSeconds).toBe(300);
    });

    it("should handle startPasteEvaluation without topics", () => {
      const state = codingReducer(
        initialState,
        startPasteEvaluation({
          pasteEvaluationId: "eval-1",
          pastedContent: "function test() {}",
          timestamp: 123456,
        })
      );
      expect(state.activePasteEvaluation).toBeDefined();
      expect(state.activePasteEvaluation!.pasteEvaluationId).toBe("eval-1");
      expect(state.activePasteEvaluation!.pastedContent).toBe(
        "function test() {}"
      );
      expect(state.activePasteEvaluation!.timestamp).toBe(123456);
      expect(state.activePasteEvaluation!.answerCount).toBe(0);
      expect(state.activePasteEvaluation!.readyToEvaluate).toBe(false);
    });

    it("should handle startPasteEvaluation with topics", () => {
      const topics = [
        { name: "Functions", description: "Function usage", percentage: 40 },
        { name: "Async", description: "Async patterns", percentage: 60 },
      ];
      const state = codingReducer(
        initialState,
        startPasteEvaluation({
          pasteEvaluationId: "eval-1",
          pastedContent: "code",
          timestamp: 123,
          topics,
        })
      );
      expect(state.activePasteEvaluation!.topics).toEqual(topics);
    });

    it("should handle incrementPasteAnswer", () => {
      let state = codingReducer(
        initialState,
        startPasteEvaluation({
          pasteEvaluationId: "eval-1",
          pastedContent: "code",
          timestamp: 123,
        })
      );
      expect(state.activePasteEvaluation!.answerCount).toBe(0);

      state = codingReducer(state, incrementPasteAnswer());
      expect(state.activePasteEvaluation!.answerCount).toBe(1);

      state = codingReducer(state, incrementPasteAnswer());
      expect(state.activePasteEvaluation!.answerCount).toBe(2);
    });

    it("should not crash incrementPasteAnswer without active evaluation", () => {
      const state = codingReducer(initialState, incrementPasteAnswer());
      expect(state.activePasteEvaluation).toBeUndefined();
    });

    it("should handle resetInterview global action", () => {
      const populatedState: CodingState = {
        messages: [{ id: "1", text: "test", speaker: "user", timestamp: 123 }],
        pendingReply: true,
        timeboxSeconds: 300,
        activePasteEvaluation: {
          pasteEvaluationId: "eval-1",
          pastedContent: "code",
          timestamp: 123,
          pasteAccountabilityScore: 50,
          answerCount: 2,
          readyToEvaluate: false,
        },
      };
      const state = codingReducer(populatedState, resetInterview());
      expect(state).toEqual(initialState);
    });
  });
});
