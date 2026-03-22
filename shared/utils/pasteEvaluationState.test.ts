import { describe, expect, it } from "vitest";

import {
  getPasteClarificationCount,
  getPasteEvalConversation,
  getUpdatedPasteAnswerCount,
  hasFinalizedPasteEvaluation,
  isCompletedPasteEvaluation,
  shouldClearStuckPasteEvaluation,
} from "./pasteEvaluationState";

function buildPasteEvaluation(overrides = {}) {
  return {
    pasteEvaluationId: "paste-1",
    pastedContent: "const answer = 42;",
    timestamp: 123,
    pasteAccountabilityScore: 0,
    answerCount: 0,
    readyToEvaluate: false,
    questionScores: [],
    ...overrides,
  };
}

describe("isCompletedPasteEvaluation", () => {
  it("returns false before a final score or summary exists", () => {
    expect(isCompletedPasteEvaluation(buildPasteEvaluation())).toBe(false);
  });

  it("returns true for completed evaluations", () => {
    expect(
      isCompletedPasteEvaluation(
        buildPasteEvaluation({
          readyToEvaluate: true,
          evaluationCaption: "Candidate understood the pasted code.",
        })
      )
    ).toBe(true);
  });
});

describe("hasFinalizedPasteEvaluation", () => {
  it("returns false when completion was marked but summary data is still pending", () => {
    expect(
      hasFinalizedPasteEvaluation(
        buildPasteEvaluation({
          readyToEvaluate: true,
        })
      )
    ).toBe(false);
  });

  it("returns true once a final score or summary exists", () => {
    expect(
      hasFinalizedPasteEvaluation(
        buildPasteEvaluation({
          evaluationCaption: "Candidate understood the pasted code.",
        })
      )
    ).toBe(true);
  });
});

describe("shouldClearStuckPasteEvaluation", () => {
  it("returns true for unfinished evaluations without an active question", () => {
    expect(shouldClearStuckPasteEvaluation(buildPasteEvaluation())).toBe(true);
  });

  it("returns false for completed evaluations that already cleared the question", () => {
    expect(
      shouldClearStuckPasteEvaluation(
        buildPasteEvaluation({
          readyToEvaluate: true,
          currentQuestion: undefined,
          evaluationCaption: "Candidate understood the pasted code.",
        })
      )
    ).toBe(false);
  });

  it("returns false while a paste-eval question is still active", () => {
    expect(
      shouldClearStuckPasteEvaluation(
        buildPasteEvaluation({ currentQuestion: "What does this return?" })
      )
    ).toBe(false);
  });
});

describe("getUpdatedPasteAnswerCount", () => {
  it("does not increment the budget for clarification turns", () => {
    expect(getUpdatedPasteAnswerCount(1, "clarification_request")).toBe(1);
  });

  it("increments the budget for substantive and give-up turns", () => {
    expect(getUpdatedPasteAnswerCount(1, "substantive")).toBe(2);
    expect(getUpdatedPasteAnswerCount(1, "dont_know")).toBe(2);
  });
});

describe("getPasteClarificationCount", () => {
  it("counts only clarification_request turns", () => {
    expect(
      getPasteClarificationCount([
        { detectedAnswerType: "clarification_request" },
        { detectedAnswerType: "substantive" },
        { detectedAnswerType: "clarification_request" },
      ])
    ).toBe(2);
  });
});

describe("getPasteEvalConversation", () => {
  it("keeps only tagged paste-eval messages from the active paste onward", () => {
    const transcript = getPasteEvalConversation(
      [
        {
          id: "old-ai",
          text: "Earlier paste question",
          speaker: "ai",
          timestamp: 80,
          isPasteEval: true,
        },
        {
          id: "coding",
          text: "How do I center this div?",
          speaker: "user",
          timestamp: 120,
        },
        {
          id: "paste-ai",
          text: "What does this function return?",
          speaker: "ai",
          timestamp: 150,
          isPasteEval: true,
        },
        {
          id: "paste-user",
          text: "It returns the cached value.",
          speaker: "user",
          timestamp: 160,
          isPasteEval: true,
        },
      ],
      100
    );

    expect(transcript.conversation).toEqual([
      { role: "assistant", content: "What does this function return?" },
      { role: "user", content: "It returns the cached value." },
    ]);
    expect(transcript.aiQuestions).toBe("What does this function return?");
    expect(transcript.userAnswers).toBe("It returns the cached value.");
  });
});
