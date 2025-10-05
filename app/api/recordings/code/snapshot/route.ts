import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const session_id: string | undefined = body?.session_id;
        const content: string | undefined = body?.content;
        const company: string | undefined = body?.company;
        const job_role: string | undefined = body?.job_role;
        const candidate: string | undefined = body?.candidate;
        const initial_code: boolean | undefined =
            typeof body?.initial_code === "boolean"
                ? (body.initial_code as boolean)
                : undefined;
        const ms: number = typeof body?.ms === "number" ? body.ms : Date.now();
        const ts: string = body?.ts || new Date().toISOString();
        if (!session_id || typeof content !== "string") {
            return NextResponse.json(
                { error: "session_id and content are required" },
                { status: 400 }
            );
        }
        const base =
            company && job_role && candidate
                ? path.join(
                      process.cwd(),
                      "recordings",
                      company,
                      job_role,
                      candidate,
                      session_id
                  )
                : path.join(process.cwd(), "recordings", session_id);
        const root = path.join(base, "code");
        fs.mkdirSync(root, { recursive: true });
        const filePath = path.join(root, "snapshots.jsonl");
        const payload: any = { ms, ts, content };
        if (typeof initial_code === "boolean")
            payload.initial_code = initial_code;
        if (body?.tag && typeof body.tag === "string") payload.tag = body.tag;
        const line = JSON.stringify(payload) + "\n";
        fs.appendFileSync(filePath, line);
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json(
            { error: String(e?.message || e) },
            { status: 500 }
        );
    }
}
