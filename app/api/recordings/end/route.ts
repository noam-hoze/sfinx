import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function POST(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const session_id = searchParams.get("session_id");
        if (!session_id) {
            return NextResponse.json(
                { error: "session_id required" },
                { status: 400 }
            );
        }
        const root = path.join(process.cwd(), "recordings", session_id);
        // Touch an ended marker
        fs.writeFileSync(
            path.join(root, "logs", "ended.txt"),
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
