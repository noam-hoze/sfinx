import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        // Minimal server debug
        // eslint-disable-next-line no-console
        console.log("[recordings/transcript] body", body);
        const session_id: string | undefined = body?.session_id;
        const interviewer_id: string | undefined = body?.interviewer_id;
        const candidate_id: string | undefined = body?.candidate_id;
        const t: number = typeof body?.t === "number" ? body.t : Date.now();
        const role: string | undefined = body?.role;
        const speaker: string | undefined = body?.speaker;
        const text: string | undefined = body?.text;
        if (!session_id || !role || !speaker || typeof text !== "string") {
            return NextResponse.json(
                { error: "session_id, role, speaker, text are required" },
                { status: 400 }
            );
        }
        const root =
            interviewer_id && candidate_id
                ? path.join(
                      process.cwd(),
                      "recordings",
                      `${interviewer_id}_interviewer`,
                      `${candidate_id}_candidate`,
                      session_id
                  )
                : path.join(process.cwd(), "recordings", session_id);
        fs.mkdirSync(root, { recursive: true });
        const filePath = path.join(root, "transcript.jsonl");
        const line = JSON.stringify({ t, role, speaker, text }) + "\n";
        fs.appendFileSync(filePath, line);
        // eslint-disable-next-line no-console
        console.log("[recordings/transcript] appended", { filePath, line });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json(
            { error: String(e?.message || e) },
            { status: 500 }
        );
    }
}
