/**
 * Background Confidence Scorer types for the interview Background stage.
 * Defines pillars, evidence, and assessment structure used across the app.
 */

/** Supported evaluation pillars for the Background stage. */
export type BackgroundPillar = "adaptability" | "creativity" | "reasoning";

/** Evidence captured from candidate answers and mapped to pillars. */
export interface BackgroundEvidence {
    id: string;
    text: string;
    pillarTags: BackgroundPillar[];
}

/** Aggregate assessment state for the Background stage. */
export interface BackgroundAssessment {
    confidence: number; // 0–100
    perPillarRationale: Partial<Record<BackgroundPillar, string>>;
    evidence: BackgroundEvidence[];
    lastUpdatedAt: number; // epoch millis
}

/** Scoring result for a single answer. */
export interface ScoringResult {
    assessment: BackgroundAssessment;
    deltas: Partial<Record<BackgroundPillar, number>>;
    evidence: BackgroundEvidence;
}

/**
 * Heuristic tagger for pillars based on keywords. This is a placeholder for LLM-driven analysis.
 */
function tagPillars(answer: string): BackgroundPillar[] {
    const a = answer.toLowerCase();
    const tags: Set<BackgroundPillar> = new Set();
    if (/pivot|change|adapt|shift|requirement|deadline|priority|trade-?off/.test(a)) tags.add("adaptability");
    if (/design|brainstorm|novel|creative|alternative|redesign|prototype|idea/.test(a)) tags.add("creativity");
    if (/reason|because|justify|constraint|complexity|edge case|assumption/.test(a)) tags.add("reasoning");
    if (tags.size === 0) tags.add("reasoning");
    return Array.from(tags);
}

/** Clamp confidence to [0,100]. */
function clampConfidence(value: number): number {
    if (value < 0) return 0;
    if (value > 100) return 100;
    return value;
}

/**
 * Update the background assessment from a new candidate answer.
 * Simple heuristic: +4 per tagged pillar, capped at +10 per answer; minor decay if irrelevant.
 */
export function updateFromAnswer(prev: BackgroundAssessment, answer: string): ScoringResult {
    const tags = tagPillars(answer);
    const evidence: BackgroundEvidence = {
        id: `${Date.now()}-${Math.random()}`,
        text: answer,
        pillarTags: tags,
    };

    const baseDelta = Math.min(10, 4 * tags.length);
    const newConfidence = clampConfidence(prev.confidence + baseDelta);

    const newRationale: Partial<Record<BackgroundPillar, string>> = { ...prev.perPillarRationale };
    for (const t of tags) {
        const snippet = answer.length > 140 ? `${answer.slice(0, 137)}...` : answer;
        newRationale[t] = `Evidence: ${snippet}`;
    }

    const assessment: BackgroundAssessment = {
        confidence: newConfidence,
        perPillarRationale: newRationale,
        evidence: [...prev.evidence, evidence],
        lastUpdatedAt: Date.now(),
    };

    const deltas: Partial<Record<BackgroundPillar, number>> = {};
    for (const t of tags) deltas[t] = (deltas[t] || 0) + 4;

    return { assessment, deltas, evidence };
}
