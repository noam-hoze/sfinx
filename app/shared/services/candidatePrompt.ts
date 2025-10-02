export type CandidateTraits = {
    independent: number; // 0-100
    creative: number; // 0-100
    resilient: number; // 0-100
    testingRigor: number; // 0-100
    documentationRigor: number; // 0-100
    pragmatism: number; // 0-100
    riskAversion: number; // 0-100
    pace: number; // 0-100
    verbosity: number; // 0-100
};

export type FewShot = {
    name: string;
    text: string; // natural language guidance (no code)
    codeEdits: Array<{
        file: string;
        range: { start: number; end: number };
        replacement: string;
    }>;
};

export type CandidatePrompt = {
    system: string;
    persona: string;
    behaviorRules: string[];
    fewShots: FewShot[];
};

function clampPercent(value: number): number {
    if (Number.isNaN(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
}

export function buildCandidatePrompt(
    traits: CandidateTraits,
    fewShots: FewShot[]
): CandidatePrompt {
    const t = {
        independent: clampPercent(traits.independent),
        creative: clampPercent(traits.creative),
        resilient: clampPercent(traits.resilient),
        testingRigor: clampPercent(traits.testingRigor),
        documentationRigor: clampPercent(traits.documentationRigor),
        pragmatism: clampPercent(traits.pragmatism),
        riskAversion: clampPercent(traits.riskAversion),
        pace: clampPercent(traits.pace),
        verbosity: clampPercent(traits.verbosity),
    };

    const system =
        "You are the candidate. You speak via TTS when not coding. " +
        "Only write code when explicitly asked to code. Return code only via codeEdits; never include code in speech.";

    const persona =
        `Independent=${t.independent}%, Creative=${t.creative}%, Resilient=${t.resilient}%, ` +
        `TestingRigor=${t.testingRigor}%, DocumentationRigor=${t.documentationRigor}%, ` +
        `Pragmatism=${t.pragmatism}%, RiskAversion=${t.riskAversion}%, Pace=${t.pace}%, Verbosity=${t.verbosity}%`;

    const behaviorRules = [
        "When asked to code, propose small, localized edits first; iterate.",
        "Never type and talk at the same time; respect turn-taking.",
        "Testing and docs depth scale with TestingRigor and DocumentationRigor.",
        "Do not modify multiple files unless asked or clearly required.",
        "Never include code in spoken text; code only via codeEdits.",
    ];

    // Enforce no code in few-shot text guidance
    const codeLike = /```|`|\bfunction\b|\bconst\b|\blet\b|<\w+>/;
    fewShots.forEach((fs) => {
        if (codeLike.test(fs.text)) {
            throw new Error(
                `Few-shot "${fs.name}" contains code in text; move code to codeEdits`
            );
        }
    });

    return { system, persona, behaviorRules, fewShots };
}
