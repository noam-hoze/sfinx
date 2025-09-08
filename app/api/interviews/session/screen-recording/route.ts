import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../../lib/auth";
import { logger } from "../../../../../lib";

export async function POST(request: NextRequest) {
    try {
        logger.info("🔍 Screen recording upload API called");

        const session = await getServerSession(authOptions);
        logger.info(
            "🔍 Session check:",
            session ? "Session found" : "No session"
        );
        logger.info("🔍 User ID:", (session?.user as any)?.id);

        // Temporarily disable auth check for debugging
        // if (!(session?.user as any)?.id) {
        //     console.log("❌ No user ID in session");
        //     return NextResponse.json(
        //         { error: "Unauthorized" },
        //         { status: 401 }
        //     );
        // }

        const formData = await request.formData();
        const recording = formData.get("recording") as File;

        logger.info("📁 Recording file received:", recording ? "Yes" : "No");
        logger.info(
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
            logger.warn("❌ No recording file provided");
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
        logger.info("📂 Creating directory:", recordingsDir);

        try {
            await mkdir(recordingsDir, { recursive: true });
            logger.info("✅ Directory created successfully");
        } catch (error) {
            logger.warn(
                "⚠️ Directory creation error (might already exist):",
                error
            );
        }

        // Generate unique filename
        const timestamp = Date.now();
        const filename = `recording-${timestamp}.mp4`;
        const filepath = join(recordingsDir, filename);

        logger.info("💾 Saving file to:", filepath);

        // Convert File to Buffer and save
        const bytes = await recording.arrayBuffer();
        const buffer = Buffer.from(bytes);
        logger.info("📊 Buffer size:", buffer.length);

        await writeFile(filepath, buffer);
        logger.info("✅ File written successfully");

        // Create public URL for the recording
        const recordingUrl = `/uploads/recordings/${filename}`;

        logger.info("✅ Recording uploaded successfully:", recordingUrl);

        return NextResponse.json({
            message: "Recording uploaded successfully",
            recordingUrl,
            filename,
        });
    } catch (error) {
        logger.error("❌ Error uploading recording:", error);
        return NextResponse.json(
            { error: "Failed to upload recording" },
            { status: 500 }
        );
    }
}
