import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function POST(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const session_id = searchParams.get("session_id");
        const company = searchParams.get("company");
        const role = searchParams.get("role");
        const candidate = searchParams.get("candidate");
        const index = Number(searchParams.get("index") || 0);
        if (!session_id) {
            return NextResponse.json(
                { error: "session_id required" },
                { status: 400 }
            );
        }
        const root =
            company && role && candidate
                ? path.join(
                      process.cwd(),
                      "recordings",
                      company,
                      role,
                      candidate,
                      session_id
                  )
                : path.join(process.cwd(), "recordings", session_id);
        const audioPath = path.join(root, "audio_interviewer.webm");
        const chunk = Buffer.from(await req.arrayBuffer());
        // Append chunk to WAV (assumes pre-encoded PCM/WAV chunks client-side)
        fs.appendFileSync(audioPath, chunk);
        // Optionally track chunk indices
        fs.writeFileSync(
            path.join(root, "logs", "audio_index.txt"),
            String(index)
        );
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json(
            { error: String(e?.message || e) },
            { status: 500 }
        );
    }
}
