import { NextRequest, NextResponse } from "next/server";
import { mkdir, appendFile } from "fs/promises";
import { join } from "path";

export async function POST(request: NextRequest) {
    try {
        const { interviewSessionId, event } = await request.json();
        if (!interviewSessionId || !event?.type || !event?.file) {
            return NextResponse.json(
                { error: "Invalid payload" },
                { status: 400 }
            );
        }

        const dir = join(
            process.cwd(),
            "public",
            "uploads",
            "recordings",
            "training",
            "noam"
        );
        await mkdir(dir, { recursive: true });
        const filepath = join(dir, `${interviewSessionId}.code.jsonl`);

        const line =
            JSON.stringify({
                interviewSessionId,
                ts: new Date().toISOString(),
                ...event,
            }) + "\n";
        await appendFile(filepath, line, { encoding: "utf8" });

        return NextResponse.json({ ok: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}
