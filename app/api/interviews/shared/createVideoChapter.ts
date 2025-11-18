import { log } from "app/shared/services";
import prisma from "lib/prisma";
import { CHAPTER_TYPES } from "./chapterTypes";

interface CreateVideoChapterParams {
    telemetryDataId: string;
    title: string;
    startTime: number;
    description: string;
    caption: string;
}

/**
 * Creates a video chapter at the specified timestamp, automatically managing:
 * - Problem Presentation chapter (if first event)
 * - Updating previous chapter's endTime
 * - Setting current chapter's endTime based on next chapter
 * - Creating associated caption
 * 
 * Handles chronological insertion regardless of API call arrival order.
 */
export async function createVideoChapter(params: CreateVideoChapterParams) {
    const { telemetryDataId, title, startTime, description, caption } = params;

    log.info("[createVideoChapter] Creating chapter:", {
        title,
        startTime,
        telemetryDataId,
    });

    // Fetch all existing chapters for this session ordered by startTime
    const existingChapters = await prisma.videoChapter.findMany({
        where: { telemetryDataId },
        orderBy: { startTime: "asc" },
        include: { captions: true },
    });

    log.info("[createVideoChapter] Found existing chapters:", existingChapters.length);

    // If no chapters exist and this is not at time 0, create Problem Presentation chapter
    if (existingChapters.length === 0 && startTime > 0) {
        const problemPresentationChapter = await prisma.videoChapter.create({
            data: {
                telemetryDataId,
                title: CHAPTER_TYPES.PROBLEM_PRESENTATION,
                startTime: 0,
                endTime: startTime,
                description: "Initial problem setup and understanding",
                thumbnailUrl: null,
            },
        });
        log.info("[createVideoChapter] Created Problem Presentation chapter:", {
            id: problemPresentationChapter.id,
            startTime: 0,
            endTime: startTime,
        });
    }

    // Find chronological previous chapter (highest startTime less than current)
    const previousChapter = await prisma.videoChapter.findFirst({
        where: {
            telemetryDataId,
            startTime: { lt: startTime },
        },
        orderBy: { startTime: "desc" },
        include: { captions: true },
    });

    // Find chronological next chapter (lowest startTime greater than current)
    const nextChapter = await prisma.videoChapter.findFirst({
        where: {
            telemetryDataId,
            startTime: { gt: startTime },
        },
        orderBy: { startTime: "asc" },
    });

    log.info("[createVideoChapter] Adjacent chapters:", {
        previous: previousChapter ? { title: previousChapter.title, startTime: previousChapter.startTime } : null,
        next: nextChapter ? { title: nextChapter.title, startTime: nextChapter.startTime } : null,
    });

    // Update previous chapter's endTime to current startTime
    if (previousChapter) {
        await prisma.videoChapter.update({
            where: { id: previousChapter.id },
            data: { endTime: startTime },
        });
        log.info("[createVideoChapter] Updated previous chapter endTime:", {
            chapterId: previousChapter.id,
            title: previousChapter.title,
            newEndTime: startTime,
        });

        // Update all captions in previous chapter
        if (previousChapter.captions.length > 0) {
            await prisma.videoCaption.updateMany({
                where: { videoChapterId: previousChapter.id },
                data: { endTime: startTime },
            });
            log.info("[createVideoChapter] Updated previous chapter captions endTime");
        }
    }

    // Determine endTime for new chapter
    const newChapterEndTime = nextChapter ? nextChapter.startTime : 999999;

    // Create new chapter
    const newChapter = await prisma.videoChapter.create({
        data: {
            telemetryDataId,
            title,
            startTime,
            endTime: newChapterEndTime,
            description,
            thumbnailUrl: null,
        },
    });

    log.info("[createVideoChapter] Created new chapter:", {
        id: newChapter.id,
        title: newChapter.title,
        startTime: newChapter.startTime,
        endTime: newChapter.endTime,
    });

    // Create caption for new chapter
    await prisma.videoCaption.create({
        data: {
            videoChapterId: newChapter.id,
            text: caption,
            startTime,
            endTime: newChapterEndTime,
        },
    });

    log.info("[createVideoChapter] Created caption");

    // Log all chapters after creation for debugging
    const allChapters = await prisma.videoChapter.findMany({
        where: { telemetryDataId },
        orderBy: { startTime: "asc" },
    });
    log.info("[createVideoChapter] All chapters after creation:", 
        allChapters.map(c => ({ 
            title: c.title, 
            start: c.startTime, 
            end: c.endTime 
        }))
    );

    return newChapter;
}

