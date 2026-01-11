import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getServerSession } from "next-auth/next";
import { authOptions } from "app/shared/services/auth";
import { log } from "app/shared/services";

import { LOG_CATEGORIES } from "app/shared/services/logger.config";
const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

export async function POST(request: NextRequest) {
    try {
        log.info(LOG_CATEGORY, "Screen recording upload API called");

        const session = await getServerSession(authOptions);
        log.info(LOG_CATEGORY, "Session check:", session ? "Session found" : "No session");
        log.info(LOG_CATEGORY, "User ID:", (session?.user as any)?.id);

        const formData = await request.formData();
        const recording = formData.get("recording") as File;

        log.info(LOG_CATEGORY, "Recording file received:", recording ? "Yes" : "No");
        log.info(LOG_CATEGORY, 
            "File details:",
            recording
                ? {
                      name: recording.name,
                      size: recording.size,
                      type: recording.type,
                  }
                : "N/A"
        );

        if (!recording) {
            log.warn(LOG_CATEGORY, "❌ No recording file provided");
            return NextResponse.json(
                { error: "Recording file is required" },
                { status: 400 }
            );
        }

        // Generate unique filename
        const timestamp = Date.now();
        const filename = `recording-${timestamp}.mp4`;

        log.info(LOG_CATEGORY, "Uploading to Vercel Blob:", filename);

        // Upload to Vercel Blob
        const blob = await put(filename, recording, {
            access: "public",
            addRandomSuffix: true,
        });

        const recordingUrl = blob.url;

        log.info(LOG_CATEGORY, "Recording uploaded successfully to Vercel Blob:", recordingUrl);

        return NextResponse.json({
            message: "Recording uploaded successfully",
            recordingUrl,
            filename,
        });
    } catch (error) {
        log.error(LOG_CATEGORY, "❌ Error uploading recording:", error);
        return NextResponse.json(
            { error: "Failed to upload recording" },
            { status: 500 }
        );
    }
}
