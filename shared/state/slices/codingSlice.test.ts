import { describe, expect, it } from "vitest";

import reducer, {
    completePasteEvaluation,
    setPasteQuestion,
    startPasteEvaluation,
} from "./codingSlice";

describe("codingSlice paste evaluation lifecycle", () => {
    it("clears the active paste question when evaluation completes", () => {
        const startedState = reducer(
            undefined,
            startPasteEvaluation({
                pasteEvaluationId: "paste-1",
                pastedContent: "const answer = 42;",
                timestamp: 123,
            })
        );
        const questioningState = reducer(startedState, setPasteQuestion("What does this line return?"));
        const completedState = reducer(questioningState, completePasteEvaluation());

        expect(startedState.activePasteEvaluation?.accountabilityScore).toBeUndefined();
        expect(questioningState.activePasteEvaluation?.currentQuestion).toBe("What does this line return?");
        expect(completedState.activePasteEvaluation?.readyToEvaluate).toBe(true);
        expect(completedState.activePasteEvaluation?.currentQuestion).toBeUndefined();
    });
});
