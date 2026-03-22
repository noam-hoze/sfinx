import { describe, expect, it } from "vitest";

import { shouldClearStuckPasteEvaluation } from "./pasteEvaluationState";

function buildPasteEvaluation(overrides = {}) {
  return {
    pasteEvaluationId: "paste-1",
    pastedContent: "const answer = 42;",
    timestamp: 123,
    pasteAccountabilityScore: 0,
    answerCount: 0,
    readyToEvaluate: false,
    accountabilityScore: 0,
    questionScores: [],
    ...overrides,
  };
}

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
