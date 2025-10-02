import { describe, it, expect } from "vitest";
import { buildCandidatePrompt } from "./candidatePrompt";

describe("buildCandidatePrompt", () => {
    it("builds a persona and enforces no code in text", () => {
        const prompt = buildCandidatePrompt(
            {
                independent: 80,
                creative: 60,
                resilient: 70,
                testingRigor: 50,
                documentationRigor: 40,
                pragmatism: 65,
                riskAversion: 30,
                pace: 75,
                verbosity: 35,
            },
            [
                {
                    name: "rename-handler",
                    text: "Rename the handler and explain briefly why.",
                    codeEdits: [
                        {
                            file: "app/foo.ts",
                            range: { start: 0, end: 0 },
                            replacement: "export const x = 1;\n",
                        },
                    ],
                },
            ]
        );

        expect(prompt.system).toContain(
            "Only write code when explicitly asked"
        );
        expect(prompt.persona).toContain("Independent=80%");
        expect(prompt.fewShots).toHaveLength(1);
    });

    it("throws if few-shot text contains code", () => {
        expect(() =>
            buildCandidatePrompt(
                {
                    independent: 0,
                    creative: 0,
                    resilient: 0,
                    testingRigor: 0,
                    documentationRigor: 0,
                    pragmatism: 0,
                    riskAversion: 0,
                    pace: 0,
                    verbosity: 0,
                },
                [
                    {
                        name: "bad",
                        text: "```const a = 1```",
                        codeEdits: [],
                    },
                ]
            )
        ).toThrow();
    });
});
