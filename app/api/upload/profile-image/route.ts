import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "app/shared/services/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { log } from "app/shared/services";
import prisma from "lib/prisma";

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        log.info("Session:", session);
        log.info("User ID:", (session?.user as any)?.id);

        if (!(session?.user as any)?.id) {
            log.error("No session or user ID found");
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const data = await request.formData();
        const file = data.get("image") as File;
        log.info("File received:", file);
        log.info("File name:", file?.name);
        log.info("File size:", file?.size);
        log.info("File type:", file?.type);

        if (!file) {
            log.error("No file provided");
            return NextResponse.json(
                { error: "No file provided" },
                { status: 400 }
            );
        }

        // Validate file type
        if (!file.type.startsWith("image/")) {
            return NextResponse.json(
                { error: "Invalid file type" },
                { status: 400 }
            );
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json(
                { error: "File too large" },
                { status: 400 }
            );
        }

        // Generate unique filename
        const userId = (session!.user as any).id;
        const fileExtension = path.extname(file.name);
        const fileName = `${userId}-${Date.now()}${fileExtension}`;

        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(
            process.cwd(),
            "public",
            "uploads",
            "profiles"
        );
        await mkdir(uploadsDir, { recursive: true });

        // Save file
        const filePath = path.join(uploadsDir, fileName);
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filePath, buffer);

        // Generate public URL
        const imageUrl = `/uploads/profiles/${fileName}`;

        // Update user profile in database
        await prisma.user.update({
            where: { id: userId },
            data: { image: imageUrl },
        });

        return NextResponse.json({ imageUrl });
    } catch (error) {
        log.error("Upload error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
