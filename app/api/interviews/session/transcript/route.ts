import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, appendFile } from "fs/promises";
import { join } from "path";

export async function POST(request: NextRequest) {
    try {
        const { interviewSessionId, turn } = await request.json();
        if (!interviewSessionId || !turn?.text || !turn?.role) {
            return NextResponse.json(
                { error: "Invalid payload" },
                { status: 400 }
            );
        }

        const transcriptsDir = join(
            process.cwd(),
            "public",
            "uploads",
            "recordings",
            "training"
        );
        await mkdir(transcriptsDir, { recursive: true });
        const filename = `${interviewSessionId}.jsonl`;
        const filepath = join(transcriptsDir, filename);

        const line = JSON.stringify({ interviewSessionId, ...turn }) + "\n";
        await appendFile(filepath, line, { encoding: "utf8" });

        return NextResponse.json({
            message: "Appended",
            file: `/uploads/transcripts/${filename}`,
        });
    } catch (error) {
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}
