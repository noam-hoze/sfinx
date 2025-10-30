import type { ControlResult } from "./backgroundConfidenceTypes";

/**
 * Parse a CONTROL JSON string into a ControlResult. Throws on invalid shape.
 */
export function parseControlResult(jsonText: string): ControlResult {
    let obj: any;
    try {
        obj = JSON.parse(String(jsonText || ""));
    } catch (e) {
        throw new Error("CONTROL parse error: invalid JSON");
    }
    if (
        typeof obj?.pillars !== "object" ||
        typeof obj?.pillars?.adaptability !== "number" ||
        typeof obj?.pillars?.creativity !== "number" ||
        typeof obj?.pillars?.reasoning !== "number"
    ) {
        throw new Error("CONTROL parse error: missing required fields");
    }
    return {
        pillars: {
            adaptability: Number(obj.pillars.adaptability) || 0,
            creativity: Number(obj.pillars.creativity) || 0,
            reasoning: Number(obj.pillars.reasoning) || 0,
        },
        rationale: typeof obj.rationale === "string" ? obj.rationale : undefined,
        pillarRationales: typeof obj.pillarRationales === "object" ? {
            adaptability: typeof obj.pillarRationales?.adaptability === "string" ? obj.pillarRationales.adaptability : undefined,
            creativity: typeof obj.pillarRationales?.creativity === "string" ? obj.pillarRationales.creativity : undefined,
            reasoning: typeof obj.pillarRationales?.reasoning === "string" ? obj.pillarRationales.reasoning : undefined,
        } : undefined,
    } as ControlResult;
}


