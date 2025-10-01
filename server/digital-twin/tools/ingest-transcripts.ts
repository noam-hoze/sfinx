/*
 Ingest training transcripts into a simple JSON vector index for RAG.
 - Scans public/uploads/recordings/training/*.jsonl
 - Redacts basic PII (emails/phones)
 - Chunks into turns (optionally merges adjacent by same role)
 - Embeds with OpenAI text-embedding-3-small
 - Writes server/digital-twin/index/index.json
*/

import { readdir, readFile, mkdir, writeFile } from "fs/promises";
import { join } from "path";

type Turn = {
    interviewSessionId: string;
    role: string;
    text: string;
    ts?: string;
};

function redactPII(text: string): string {
    let t = text;
    // emails
    t = t.replace(
        /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
        "[redacted-email]"
    );
    // phone numbers (simple)
    t = t.replace(/\+?\d[\d\s().-]{6,}\d/g, "[redacted-phone]");
    return t;
}

async function embedAll(texts: string[], apiKey: string): Promise<number[][]> {
    const url = "https://api.openai.com/v1/embeddings";
    const model = "text-embedding-3-small";
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, input: texts }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Embedding failed: ${res.status} ${text}`);
    }
    const data = await res.json();
    return data.data.map((d: any) => d.embedding as number[]);
}

async function main() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.error("OPENAI_API_KEY missing");
        process.exit(1);
    }

    const trainingDir = join(
        process.cwd(),
        "public",
        "uploads",
        "recordings",
        "training"
    );
    const files = (await readdir(trainingDir)).filter((f) =>
        f.endsWith(".jsonl")
    );
    const turns: Array<{
        id: string;
        sessionId: string;
        role: string;
        text: string;
    }> = [];

    for (const file of files) {
        const sessionId = file.replace(/\.jsonl$/, "");
        const raw = await readFile(join(trainingDir, file), {
            encoding: "utf8",
        });
        const lines = raw
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);
        for (let i = 0; i < lines.length; i += 1) {
            try {
                const t = JSON.parse(lines[i]) as Turn;
                const text = redactPII((t.text || "").trim());
                if (!text) continue;
                turns.push({
                    id: `${sessionId}-${i}`,
                    sessionId,
                    role: t.role || "unknown",
                    text,
                });
            } catch {
                // skip bad line
            }
        }
    }

    if (turns.length === 0) {
        console.log("No transcript turns found.");
        return;
    }

    // Embed in batches
    const batchSize = 64;
    const vectors: number[][] = [];
    for (let i = 0; i < turns.length; i += batchSize) {
        const batch = turns.slice(i, i + batchSize);
        const vecs = await embedAll(
            batch.map((t) => t.text),
            apiKey
        );
        vectors.push(...vecs);
        console.log(
            `Embedded ${Math.min(i + batch.length, turns.length)} / ${
                turns.length
            }`
        );
    }

    const outDir = join(process.cwd(), "server", "digital-twin", "index");
    await mkdir(outDir, { recursive: true });
    const out = {
        model: "text-embedding-3-small",
        createdAt: new Date().toISOString(),
        dimension: vectors[0]?.length || null,
        chunks: turns.map((t, idx) => ({
            id: t.id,
            sessionId: t.sessionId,
            role: t.role,
            text: t.text,
            vector: vectors[idx],
        })),
    };
    await writeFile(join(outDir, "index.json"), JSON.stringify(out));
    console.log("Index written to server/digital-twin/index/index.json");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
