import { describe, it, expect } from "vitest";

describe("next-question response payload", () => {
    it("includes detectedAnswerType for frontend probe tracking", async () => {
        process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "test-key";
        const { buildNextQuestionResponse } = await import("./route");
        const response = buildNextQuestionResponse({
            answerType: "substantive",
            result: {
                detectedAnswerType: "substantive",
                question: "How did you size that buffer?",
                probeAngle: "sizing",
                fingerprint: {
                    topic: "Concurrency",
                    angle: "sizing",
                    slot: "actual_number",
                },
            },
            newFocusTopic: "Concurrency",
            isGibberish: false,
            isClarificationRequest: false,
            isDontKnow: false,
            shouldIncrementRetry: false,
            shouldMoveOn: false,
            elapsed: 120,
        });

        expect(response.detectedAnswerType).toBe("substantive");
        expect(response.fingerprint).toEqual({
            topic: "Concurrency",
            angle: "sizing",
            slot: "actual_number",
        });
    });
});
