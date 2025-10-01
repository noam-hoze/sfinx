import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { getServerSession } from "next-auth/next";
import { authOptions } from "app/shared/services/auth";
import { logger } from "app/shared/services";

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
        const sessionId = formData.get("sessionId") as string | null;
        const mode = (formData.get("mode") as string | null) || undefined;

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
        const recordingsDir =
            mode === "training"
                ? join(
                      process.cwd(),
                      "public",
                      "uploads",
                      "recordings",
                      "training",
                      "noam"
                  )
                : join(process.cwd(), "public", "uploads", "recordings");
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

        // Generate filename. In training mode, use the provided sessionId for association
        const timestamp = Date.now();
        const filename =
            mode === "training" && sessionId
                ? `${sessionId}.mp4`
                : `recording-${timestamp}.mp4`;
        const filepath = join(recordingsDir, filename);

        logger.info("💾 Saving file to:", filepath);

        // Convert File to Buffer and save
        const bytes = await recording.arrayBuffer();
        const buffer = Buffer.from(bytes);
        logger.info("📊 Buffer size:", buffer.length);

        await writeFile(filepath, buffer);
        logger.info("✅ File written successfully");

        // Create public URL for the recording
        const recordingUrl =
            mode === "training"
                ? `/uploads/recordings/training/noam/${filename}`
                : `/uploads/recordings/${filename}`;

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
