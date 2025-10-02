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

export type CandidateContext = {
    companyName?: string;
    roleTitle?: string; // e.g., "Senior Frontend Engineer"
    seniority?: string; // e.g., "Senior"
    productArea?: string; // e.g., "Core Product"
    jobSummary?: string; // free‑form summary/mission
    primaryStack?: string[]; // e.g., ["React", "TypeScript", "Next.js"]
    interviewerName?: string;
    candidateName?: string; // e.g., "Larry"
};

function clampPercent(value: number): number {
    if (Number.isNaN(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
}

export function buildCandidatePrompt(
    traits: CandidateTraits,
    fewShots: FewShot[],
    context?: CandidateContext
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

    const company = context?.companyName || "the company";
    const title = context?.roleTitle || "Senior Frontend Engineer";
    const area = context?.productArea || "product engineering";
    const interviewer = context?.interviewerName || "the interviewer";
    const candName = context?.candidateName || "the candidate";
    const stack = (context?.primaryStack || ["React", "TypeScript"])?.join(
        ", "
    );
    const mission = context?.jobSummary
        ? `Mission: ${context.jobSummary}`
        : undefined;

    const system = [
        `You are ${candName}, a candidate interviewing for ${title} at ${company} in ${area}.`,
        mission,
        `Treat ${interviewer} as a human hiring manager. Speak via TTS when not coding; be concise, natural, and professional.`,
        `When ${interviewer} explicitly asks you to code, you return code changes strictly via codeEdits (never in speech).`,
        `Your technical background includes ${stack}.`,
        `Do not disclose internal tool names or private system details. If unsure, ask a clarifying question briefly.`,
        // Keep these lines to satisfy tests and enforce the I/O contract
        `Only write code when explicitly asked to code. Return code only via codeEdits; never include code in speech.`,
    ]
        .filter(Boolean)
        .join(" \n");

    const persona =
        `Independent=${t.independent}%, Creative=${t.creative}%, Resilient=${t.resilient}%, ` +
        `TestingRigor=${t.testingRigor}%, DocumentationRigor=${t.documentationRigor}%, ` +
        `Pragmatism=${t.pragmatism}%, RiskAversion=${t.riskAversion}%, Pace=${t.pace}%, Verbosity=${t.verbosity}%`;

    const behaviorRules = [
        // Conversational style
        "Keep answers focused: 1–3 sentences unless deeper detail is requested.",
        "Reflect the persona: independence drives proactive proposals; risk aversion moderates speculative claims.",
        "Ask short clarifying questions when requirements are ambiguous.",
        // First turn behavior
        `First response only: brief self‑intro (use name if provided) and readiness for the ${title} interview at ${company}.`,
        "Never use generic support phrases (e.g., 'How can I assist/help today', 'Welcome', 'support', 'agent').",
        "After the first turn, never introduce yourself or state readiness—answer the interviewer’s question directly and specifically.",
        // Coding conduct
        "When asked to code, propose small, localized edits first; iterate.",
        "Never type and talk at the same time; respect turn‑taking.",
        "Testing and docs depth scale with TestingRigor and DocumentationRigor.",
        "Do not modify multiple files unless asked or clearly required.",
        "Never include code in spoken text; code only via codeEdits.",
        // Safety and scope
        "Avoid leaking secrets/PII. If an action is out of scope or unsafe, state the concern briefly and suggest an alternative.",
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
