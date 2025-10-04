import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const session_id: string | undefined = body?.session_id;
        const content: string | undefined = body?.content;
        const interviewer_id: string | undefined = body?.interviewer_id;
        const candidate_id: string | undefined = body?.candidate_id;
        const ms: number = typeof body?.ms === "number" ? body.ms : Date.now();
        const ts: string = body?.ts || new Date().toISOString();
        if (!session_id || typeof content !== "string") {
            return NextResponse.json(
                { error: "session_id and content are required" },
                { status: 400 }
            );
        }
        const base =
            interviewer_id && candidate_id
                ? path.join(
                      process.cwd(),
                      "recordings",
                      `${interviewer_id}_interviewer`,
                      `${candidate_id}_candidate`,
                      session_id
                  )
                : path.join(process.cwd(), "recordings", session_id);
        const root = path.join(base, "code");
        fs.mkdirSync(root, { recursive: true });
        const filePath = path.join(root, "snapshots.jsonl");
        const line = JSON.stringify({ ms, ts, content }) + "\n";
        fs.appendFileSync(filePath, line);
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json(
            { error: String(e?.message || e) },
            { status: 500 }
        );
    }
}
