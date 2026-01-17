/**
 * Unit tests for interviewSlice
 */

import { describe, it, expect } from "vitest";
import interviewReducer, {
  start,
  setCompanyContext,
  setSessionId,
  setRecording,
  setStage,
  end,
  reset,
  triggerReset,
  setPreloadedData,
  resetInterview,
  type InterviewState,
} from "./interviewSlice";

describe("interviewSlice", () => {
  const initialState: InterviewState = {
    isRecording: false,
    stage: null,
    shouldReset: false,
  };

  describe("reducers", () => {
    it("should return initial state", () => {
      const state = interviewReducer(undefined, { type: "@@INIT" });
      expect(state).toEqual(initialState);
    });

    it("should handle start action", () => {
      const state = interviewReducer(
        initialState,
        start({ candidateName: "John Doe" })
      );
      expect(state.candidateName).toBe("John Doe");
    });

    it("should handle setCompanyContext with all fields", () => {
      const state = interviewReducer(
        initialState,
        setCompanyContext({
          companyName: "Acme Corp",
          companySlug: "acme",
          roleSlug: "engineer",
        })
      );
      expect(state.companyName).toBe("Acme Corp");
      expect(state.companySlug).toBe("acme");
      expect(state.roleSlug).toBe("engineer");
    });

    it("should handle setCompanyContext with partial fields", () => {
      const state = interviewReducer(
        initialState,
        setCompanyContext({ companyName: "Acme Corp" })
      );
      expect(state.companyName).toBe("Acme Corp");
      expect(state.companySlug).toBeUndefined();
    });

    it("should handle setSessionId", () => {
      const state = interviewReducer(
        initialState,
        setSessionId({ sessionId: "session-123" })
      );
      expect(state.sessionId).toBe("session-123");
    });

    it("should handle setRecording", () => {
      let state = interviewReducer(
        initialState,
        setRecording({ isRecording: true })
      );
      expect(state.isRecording).toBe(true);

      state = interviewReducer(state, setRecording({ isRecording: false }));
      expect(state.isRecording).toBe(false);
    });

    it("should handle setStage", () => {
      const state = interviewReducer(
        initialState,
        setStage({ stage: "background" })
      );
      expect(state.stage).toBe("background");
    });

    it("should handle end action", () => {
      const state = interviewReducer(initialState, end());
      expect(state.stage).toBe("wrapup");
    });

    it("should handle triggerReset", () => {
      const state = interviewReducer(initialState, triggerReset());
      expect(state.shouldReset).toBe(true);
    });

    it("should handle reset action", () => {
      const populatedState: InterviewState = {
        isRecording: true,
        stage: "coding",
        candidateName: "John",
        companyName: "Acme",
        companySlug: "acme",
        roleSlug: "dev",
        sessionId: "s1",
        shouldReset: true,
      };
      const state = interviewReducer(populatedState, reset());
      // Reset clears most fields but keeps sessionId
      expect(state.isRecording).toBe(false);
      expect(state.stage).toBeNull();
      expect(state.candidateName).toBeUndefined();
      expect(state.companyName).toBeUndefined();
      expect(state.companySlug).toBeUndefined();
      expect(state.roleSlug).toBeUndefined();
      expect(state.shouldReset).toBe(false);
      expect(state.sessionId).toBe("s1"); // sessionId is preserved
    });

    it("should handle setPreloadedData with all fields", () => {
      const script = { questions: [] };
      const state = interviewReducer(
        initialState,
        setPreloadedData({
          userId: "u1",
          applicationId: "app1",
          script,
          preloadedFirstQuestion: "Hello?",
          preloadedFirstIntent: "greeting",
        })
      );
      expect(state.userId).toBe("u1");
      expect(state.applicationId).toBe("app1");
      expect(state.script).toEqual(script);
      expect(state.preloadedFirstQuestion).toBe("Hello?");
      expect(state.preloadedFirstIntent).toBe("greeting");
    });

    it("should handle setPreloadedData with partial fields", () => {
      const state = interviewReducer(
        initialState,
        setPreloadedData({ userId: "u1" })
      );
      expect(state.userId).toBe("u1");
      expect(state.applicationId).toBeUndefined();
    });

    it("should handle resetInterview global action", () => {
      const populatedState: InterviewState = {
        isRecording: true,
        stage: "coding",
        candidateName: "John",
        sessionId: "s1",
        shouldReset: false,
      };
      const state = interviewReducer(populatedState, resetInterview());
      expect(state).toEqual(initialState);
    });
  });
});
