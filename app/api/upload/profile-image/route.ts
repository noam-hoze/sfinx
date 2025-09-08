import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { PrismaClient } from "@prisma/client";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { logger } from "../../../../lib";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        logger.info("Session:", session);
        logger.info("User ID:", (session?.user as any)?.id);

        if (!(session?.user as any)?.id) {
            logger.error("No session or user ID found");
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const data = await request.formData();
        const file = data.get("image") as File;
        logger.info("File received:", file);
        logger.info("File name:", file?.name);
        logger.info("File size:", file?.size);
        logger.info("File type:", file?.type);

        if (!file) {
            logger.error("No file provided");
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
        logger.error("Upload error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
