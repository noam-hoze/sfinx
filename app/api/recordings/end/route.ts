import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function POST(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const session_id = searchParams.get("session_id");
        const interviewer_id = searchParams.get("interviewer_id");
        const candidate_id = searchParams.get("candidate_id");
        const company = searchParams.get("company");
        const role = searchParams.get("role");
        const candidate = searchParams.get("candidate");
        if (!session_id) {
            return NextResponse.json(
                { error: "session_id required" },
                { status: 400 }
            );
        }
        let root: string;
        if (company && role && candidate) {
            root = path.join(
                process.cwd(),
                "recordings",
                company,
                role,
                candidate,
                session_id
            );
        } else if (interviewer_id && candidate_id) {
            root = path.join(
                process.cwd(),
                "recordings",
                `${interviewer_id}_interviewer`,
                `${candidate_id}_candidate`,
                session_id
            );
        } else {
            root = path.join(process.cwd(), "recordings", session_id);
        }
        // Touch an ended marker
        const logsDir = path.join(root, "logs");
        fs.mkdirSync(logsDir, { recursive: true });
        fs.writeFileSync(
            path.join(logsDir, "ended.txt"),
            new Date().toISOString()
        );
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json(
            { error: String(e?.message || e) },
            { status: 500 }
        );
    }
}
