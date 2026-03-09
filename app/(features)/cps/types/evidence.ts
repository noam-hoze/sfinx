export interface EvidenceJumpOptions {
    caption?: string;
    categoryKey?: string | null;
    localIndex?: number | null;
    globalIndex?: number | null;
    source?: "overlay" | "row" | "external";
}

export type EvidenceJumpHandler = (
    timestamp: number,
    options?: EvidenceJumpOptions
) => void;

export interface EvidenceLink {
    timestamp: number;
    caption?: string;
    evaluation?: string;
    categoryKey?: string;
    displayCategory?: string;
    localIndex?: number;
}

export const EXTERNAL_TOOLS_EVIDENCE_CATEGORY = "External Tools Usage";
