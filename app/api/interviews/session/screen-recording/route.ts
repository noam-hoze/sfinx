import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { getServerSession } from "next-auth/next";
import { authOptions } from "app/shared/services/auth";
import { log } from "app/shared/services";

export async function POST(request: NextRequest) {
    try {
        log.info("🔍 Screen recording upload API called");

        const session = await getServerSession(authOptions);
        log.info(
            "🔍 Session check:",
            session ? "Session found" : "No session"
        );
        log.info("🔍 User ID:", (session?.user as any)?.id);

        const formData = await request.formData();
        const recording = formData.get("recording") as File;

        log.info("📁 Recording file received:", recording ? "Yes" : "No");
        log.info(
            "📁 File details:",
            recording
                ? {
                      name: recording.name,
                      size: recording.size,
                      type: recording.type,
                  }
                : "N/A"
        );

        if (!recording) {
            log.warn("❌ No recording file provided");
            return NextResponse.json(
                { error: "Recording file is required" },
                { status: 400 }
            );
        }

        // Create recordings directory if it doesn't exist
        const recordingsDir = join(
            process.cwd(),
            "public",
            "uploads",
            "recordings"
        );
        log.info("📂 Creating directory:", recordingsDir);

        try {
            await mkdir(recordingsDir, { recursive: true });
            log.info("✅ Directory created successfully");
        } catch (error) {
            log.warn(
                "⚠️ Directory creation error (might already exist):",
                error
            );
        }

        // Generate unique filename
        const timestamp = Date.now();
        const filename = `recording-${timestamp}.mp4`;
        const filepath = join(recordingsDir, filename);

        log.info("💾 Saving file to:", filepath);

        // Convert File to Buffer and save
        const bytes = await recording.arrayBuffer();
        const buffer = Buffer.from(bytes);
        log.info("📊 Buffer size:", buffer.length);

        await writeFile(filepath, buffer);
        log.info("✅ File written successfully");

        // Create public URL for the recording
        const recordingUrl = `/uploads/recordings/${filename}`;

        log.info("✅ Recording uploaded successfully:", recordingUrl);

        return NextResponse.json({
            message: "Recording uploaded successfully",
            recordingUrl,
            filename,
        });
    } catch (error) {
        log.error("❌ Error uploading recording:", error);
        return NextResponse.json(
            { error: "Failed to upload recording" },
            { status: 500 }
        );
    }
}
