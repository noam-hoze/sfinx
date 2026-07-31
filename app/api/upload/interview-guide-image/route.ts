/**
 * Upload endpoint for interview guide images (hero + team photos).
 * Saves to public/uploads/interview-guide/, returns the public URL.
 * Falls back to base64 Data URL on read-only serverless environments (e.g. Vercel).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { authOptions } from "app/shared/services/auth";
import { ensureCompanyRole } from "app/api/company/jobs/companyAuth";
import { log } from "app/shared/services";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEW_GUIDE;
const MAX_BYTES = 5 * 1024 * 1024;
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "interview-guide");

/** Validates file type and size; throws with a user-facing message on failure. */
function validateFile(file: File) {
    if (!file.type.startsWith("image/")) throw new Error("Only image files are accepted.");
    if (file.size > MAX_BYTES) throw new Error("File must be under 5 MB.");
}

/** Writes the file buffer to disk (or returns a Data URL on read-only filesystems). */
async function persistFile(file: File, userId: string): Promise<string> {
    const buffer = Buffer.from(await file.arrayBuffer());
    try {
        const ext = path.extname(file.name) || ".png";
        const fileName = `${userId}-${Date.now()}${ext}`;
        await mkdir(UPLOAD_DIR, { recursive: true });
        await writeFile(path.join(UPLOAD_DIR, fileName), buffer);
        return `/uploads/interview-guide/${fileName}`;
    } catch (fsError) {
        log.warn(LOG_CATEGORY, "Filesystem write failed, falling back to base64 Data URL", fsError);
        const mimeType = file.type || "image/png";
        return `data:${mimeType};base64,${buffer.toString("base64")}`;
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const userId = (session?.user as any)?.id as string | undefined;
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        ensureCompanyRole(session);

        const data = await request.formData();
        const file = data.get("image") as File | null;
        if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

        validateFile(file);
        const imageUrl = await persistFile(file, userId);

        log.info(LOG_CATEGORY, "Interview guide image uploaded", { userId, imageUrl: imageUrl.substring(0, 50) });
        return NextResponse.json({ imageUrl });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        const status = message === "Company role required" ? 403 : 400;
        log.error(LOG_CATEGORY, "Interview guide image upload error", error);
        return NextResponse.json({ error: message }, { status });
    }
}
