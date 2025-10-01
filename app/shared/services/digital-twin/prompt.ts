import { RespondRequest } from "./schema";
import { buildPersonaPrompt, fewShotExemplars } from "./persona";

export function composePrompt(
    req: RespondRequest,
    ctx: { snippets: string[] }
): string {
    const persona = [
        `You are the digital twin of the interviewer. Match tone and structure. Follow company guardrails. Output clear, concise answers.`,
        buildPersonaPrompt(req.interviewerId),
    ].join("\n");
    const guidanceSpec = `When relevant, also produce JSON keys guidance and scoring. If unsure, omit them.`;
    const context = ctx.snippets.map((s, i) => `CTX${i + 1}: ${s}`).join("\n");
    const history = req.history
        .slice(-8)
        .map((t) => `${t.role.toUpperCase()}: ${t.text}`)
        .join("\n");

    const shots = fewShotExemplars()
        .map((ex) => `EXAMPLE\n${ex.q}\n${ex.a}`)
        .join("\n\n");

    const user = `CANDIDATE: ${req.candidateTurn}`;
    return [persona, guidanceSpec, context, shots, history, user]
        .filter(Boolean)
        .join("\n\n");
}
