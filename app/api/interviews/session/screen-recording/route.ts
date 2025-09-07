import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../../lib/auth";

export async function POST(request: NextRequest) {
    try {
        console.log("🔍 Screen recording upload API called");

        const session = await getServerSession(authOptions);
        console.log(
            "🔍 Session check:",
            session ? "Session found" : "No session"
        );
        console.log("🔍 User ID:", (session?.user as any)?.id);

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

        console.log("📁 Recording file received:", recording ? "Yes" : "No");
        console.log(
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
            console.log("❌ No recording file provided");
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
        console.log("📂 Creating directory:", recordingsDir);

        try {
            await mkdir(recordingsDir, { recursive: true });
            console.log("✅ Directory created successfully");
        } catch (error) {
            console.log(
                "⚠️ Directory creation error (might already exist):",
                error
            );
        }

        // Generate unique filename
        const timestamp = Date.now();
        const filename = `recording-${timestamp}.mp4`;
        const filepath = join(recordingsDir, filename);

        console.log("💾 Saving file to:", filepath);

        // Convert File to Buffer and save
        const bytes = await recording.arrayBuffer();
        const buffer = Buffer.from(bytes);
        console.log("📊 Buffer size:", buffer.length);

        await writeFile(filepath, buffer);
        console.log("✅ File written successfully");

        // Create public URL for the recording
        const recordingUrl = `/uploads/recordings/${filename}`;

        console.log("✅ Recording uploaded successfully:", recordingUrl);

        return NextResponse.json({
            message: "Recording uploaded successfully",
            recordingUrl,
            filename,
        });
    } catch (error) {
        console.error("❌ Error uploading recording:", error);
        return NextResponse.json(
            { error: "Failed to upload recording" },
            { status: 500 }
        );
    }
}
