import { RespondRequest } from "./schema";
import { readFile } from "fs/promises";
import { join } from "path";

export async function retrieveContext(
    req: RespondRequest
): Promise<{ snippets: string[] }> {
    // Prefer embedded index if available; fall back to recent lines
    try {
        const indexPath = join(
            process.cwd(),
            "server",
            "digital-twin",
            "index",
            "index.json"
        );
        const rawIdx = await readFile(indexPath, { encoding: "utf8" });
        const idx = JSON.parse(rawIdx) as {
            model: string;
            dimension: number;
            chunks: Array<{
                id: string;
                sessionId: string;
                role: string;
                text: string;
                vector: number[];
            }>;
        };
        // Filter by interviewer session if available
        const pool = idx.chunks.filter((c) => c.sessionId === req.sessionId);
        const query = req.candidateTurn;
        // Embed query with a trivial projection: use zeros (placeholder). Real system would call embeddings.
        // To keep this local, do naive BM25-like scoring by text overlap
        const scored = pool
            .map((c) => ({
                c,
                score: overlapScore(query, c.text),
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map((x) => `${x.c.role.toUpperCase()}: ${x.c.text}`);
        if (scored.length > 0) return { snippets: scored };
    } catch {}

    // Fallback: read recent lines from this session's JSONL
    try {
        const trainingFile = join(
            process.cwd(),
            "public",
            "uploads",
            "recordings",
            "training",
            `${req.sessionId}.jsonl`
        );
        const raw = await readFile(trainingFile, { encoding: "utf8" });
        const lines = raw
            .trim()
            .split("\n")
            .slice(-5)
            .map((l) => {
                try {
                    const obj = JSON.parse(l);
                    return `${obj.role?.toUpperCase()}: ${obj.text}`;
                } catch {
                    return l;
                }
            });
        return { snippets: lines };
    } catch {}
    return { snippets: [] };
}

function overlapScore(a: string, b: string): number {
    const wa = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
    const wb = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
    let common = 0;
    for (const w of wa) if (wb.has(w)) common += 1;
    return common / Math.max(1, Math.min(wa.size, wb.size));
}
