import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
    try {
        const data = await request.formData();
        const file: File | null = data.get("video") as unknown as File;

        if (!file) {
            return NextResponse.json({
                success: false,
                error: "No video file found.",
            });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // For now, save it to a temporary directory on the server
        const tempDir = path.join(process.cwd(), "tmp");

        // Ensure the temp directory exists
        await require("fs").promises.mkdir(tempDir, { recursive: true });

        const videoId = `interview-recording-${Date.now()}.webm`;
        const filePath = path.join(tempDir, videoId);

        await writeFile(filePath, buffer);
        console.log(`Video saved to ${filePath}`);

        // In the future, you would trigger OpenFace processing here
        // For example: triggerOpenFaceProcessing(filePath);

        return NextResponse.json({ success: true, videoId });
    } catch (error) {
        console.error("Error uploading video:", error);
        return NextResponse.json(
            { success: false, error: "Video upload failed." },
            { status: 500 }
        );
    }
}
