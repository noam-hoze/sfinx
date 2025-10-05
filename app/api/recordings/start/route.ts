import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const session_id = body?.session_id as string;
        const metadata = body?.metadata;
        if (!session_id || !metadata) {
            return NextResponse.json(
                { error: "session_id and metadata required" },
                { status: 400 }
            );
        }
        // derive nested path from metadata
        const company: string | undefined = metadata?.company;
        const role: string | undefined = metadata?.role;
        const candidateSlug: string | undefined = metadata?.candidate_slug;
        const root =
            company && role && candidateSlug
                ? path.join(
                      process.cwd(),
                      "recordings",
                      company,
                      role,
                      candidateSlug,
                      session_id
                  )
                : path.join(process.cwd(), "recordings", session_id);
        const codeDir = path.join(root, "code");
        const logsDir = path.join(root, "logs");
        fs.mkdirSync(codeDir, { recursive: true });
        fs.mkdirSync(logsDir, { recursive: true });
        fs.writeFileSync(
            path.join(root, "metadata.json"),
            JSON.stringify(metadata, null, 2)
        );
        // Ensure transcript file exists
        const transcriptPath = path.join(root, "transcript.jsonl");
        if (!fs.existsSync(transcriptPath)) {
            fs.writeFileSync(transcriptPath, "");
        }
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json(
            { error: String(e?.message || e) },
            { status: 500 }
        );
    }
}
