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
        const root = path.join(process.cwd(), "recordings", session_id);
        const codeDir = path.join(root, "code");
        const logsDir = path.join(root, "logs");
        fs.mkdirSync(codeDir, { recursive: true });
        fs.mkdirSync(logsDir, { recursive: true });
        fs.writeFileSync(
            path.join(root, "metadata.json"),
            JSON.stringify(metadata, null, 2)
        );
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json(
            { error: String(e?.message || e) },
            { status: 500 }
        );
    }
}
