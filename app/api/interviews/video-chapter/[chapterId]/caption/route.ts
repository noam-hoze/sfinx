import { NextRequest, NextResponse } from "next/server";
import { log } from "app/shared/services";
import prisma from "lib/prisma";

type RouteContext = {
    params: Promise<{ chapterId?: string | string[] }>;
};

function normalizeId(id: string | string[] | undefined) {
    if (Array.isArray(id)) {
        return id[0] ?? "";
    }
    return id ?? "";
}

/**
 * PATCH /api/interviews/video-chapter/[chapterId]/caption
 * Updates the VideoCaption text for a given VideoChapter.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        const { chapterId: rawChapterId } = await context.params;
        const chapterId = normalizeId(rawChapterId);

        if (!chapterId) {
            return NextResponse.json(
                { error: "Chapter ID is required" },
                { status: 400 }
            );
        }

        const body = await request.json();
        const { caption } = body;

        if (!caption) {
            return NextResponse.json(
                { error: "Caption text is required" },
                { status: 400 }
            );
        }

        log.info("[VideoCaption Update API] Updating caption for chapter:", chapterId);

        // Find the VideoCaption for this chapter
        const videoCaption = await prisma.videoCaption.findFirst({
            where: { videoChapterId: chapterId },
        });

        if (!videoCaption) {
            return NextResponse.json(
                { error: "VideoCaption not found for this chapter" },
                { status: 404 }
            );
        }

        // Update the caption text
        const updatedCaption = await prisma.videoCaption.update({
            where: { id: videoCaption.id },
            data: { text: caption },
        });

        log.info("[VideoCaption Update API] Caption updated successfully:", updatedCaption.id);

        return NextResponse.json({
            message: "Caption updated successfully",
            captionId: updatedCaption.id,
        });
    } catch (error: any) {
        log.error("[VideoCaption Update API] Error updating caption:", error);
        return NextResponse.json(
            {
                error: "Failed to update caption",
                details: process.env.NODE_ENV !== "production" ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}

