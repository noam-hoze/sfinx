import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "app/shared/services/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { log } from "app/shared/services";
import prisma from "lib/prisma";

import { LOG_CATEGORIES } from "app/shared/services/logger.config";
const LOG_CATEGORY = LOG_CATEGORIES.UPLOAD;

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const userId = (session?.user as any)?.id;

        if (!userId) {
            log.error(LOG_CATEGORY, "No session or user ID found");
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const data = await request.formData();
        const file = data.get("image") as File;

        if (!file) {
            log.error(LOG_CATEGORY, "No file provided");
            return NextResponse.json(
                { error: "No file provided" },
                { status: 400 }
            );
        }

        // Validate file type
        if (!file.type.startsWith("image/")) {
            return NextResponse.json(
                { error: "Invalid file type. Only images are allowed." },
                { status: 400 }
            );
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json(
                { error: "File size must be under 5MB." },
                { status: 400 }
            );
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        let imageUrl: string;

        try {
            // Try saving to local disk (for local development)
            const fileExtension = path.extname(file.name) || ".png";
            const fileName = `${userId}-${Date.now()}${fileExtension}`;
            const uploadsDir = path.join(
                process.cwd(),
                "public",
                "uploads",
                "profiles"
            );
            await mkdir(uploadsDir, { recursive: true });
            const filePath = path.join(uploadsDir, fileName);
            await writeFile(filePath, buffer);
            imageUrl = `/uploads/profiles/${fileName}`;
        } catch (fsError) {
            // Fallback for read-only serverless environment (e.g. Vercel)
            log.warn(LOG_CATEGORY, "Filesystem write failed, falling back to base64 Data URL", fsError);
            const mimeType = file.type || "image/png";
            imageUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
        }

        // Update user profile in database
        await prisma.user.update({
            where: { id: userId },
            data: { image: imageUrl },
        });

        log.info(LOG_CATEGORY, "Profile image updated successfully for user:", userId);

        return NextResponse.json({ imageUrl });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        log.error(LOG_CATEGORY, "Upload error:", error);
        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
