#!/usr/bin/env tsx

import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { seedBasicCandidate, ensureApplicationForCompany } from "../seed-utils";
import { log } from "app/shared/services/logger";

const prisma = new PrismaClient();

const CaptionSchema = z.object({
    id: z.string(),
    text: z.string(),
    startTime: z.number(),
    endTime: z.number(),
});

const ChapterSchema = z.object({
    id: z.string(),
    title: z.string(),
    startTime: z.number(),
    endTime: z.number(),
    thumbnailUrl: z.string().optional(),
    captions: z.array(CaptionSchema).optional(),
});

const VideoEvidenceSchema = z.object({
    id: z.string(),
    title: z.string(),
    startTime: z.number().nullable().optional(),
    category: z.string().optional(),
    thumbnailUrl: z.string().optional(),
});

type Caption = z.infer<typeof CaptionSchema>;
type Chapter = z.infer<typeof ChapterSchema>;
type VideoEvidence = z.infer<typeof VideoEvidenceSchema>;

const GapSchema = z.object({
    id: z.string(),
    severity: z.string(),
    description: z.string(),
    // color removed from JSON; mapped from severity
    evidenceLinks: z.array(z.number()).default([]),
});

const SeedSchema = z.object({
    user: z.object({
        name: z.string(),
        email: z.string().email(),
        image: z.string().optional(),
        jobTitle: z.string(),
        location: z.string(),
        bio: z.string(),
        skills: z.array(z.string()),
    }),
    application: z.object({ companyId: z.string() }),
    interviewSession: z.object({
        id: z.string(),
        videoUrl: z.string(),
        duration: z.number().optional(),
        status: z.string().default("COMPLETED"),
        createdAt: z.string().datetime().optional(),
    }),
    telemetry: z.object({
        id: z.string(),
        matchScore: z.number(),
        confidence: z.string(),
        story: z.string(),
        hasFairnessFlag: z.boolean().default(false),
        persistenceFlow: z.any().optional(),
        learningToAction: z.any().optional(),
        confidenceCurve: z.any().optional(),
    }),
    workstyleMetrics: z.object({
        id: z.string(),
        iterationSpeed: z.number().nullable().optional(),
        debugLoops: z.number().nullable().optional(),
        refactorCleanups: z.number().nullable().optional(),
        aiAssistUsage: z.number().nullable().optional(),
    }),
    gaps: z.array(GapSchema).default([]),
    evidenceClips: z.array(VideoEvidenceSchema).optional(),
    videoEvidence: z.array(VideoEvidenceSchema).optional(),
    videoChapters: z.array(ChapterSchema).default([]),
});

export async function seedCandidateFromFile(
    filePath: string,
    options: { reset?: boolean } = { reset: true }
) {
    const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(process.cwd(), filePath);
    const raw = fs.readFileSync(absolutePath, "utf-8");
    const parsed = SeedSchema.parse(JSON.parse(raw));

    try {
        const {
            user,
            application,
            interviewSession,
            telemetry,
            workstyleMetrics,
            gaps,
        } = parsed;
        const videoChapters = (parsed as any).videoChapters as Chapter[];
        const videoEvidence = ((parsed as any).videoEvidence ??
            (parsed as any).evidenceClips ??
            []) as VideoEvidence[];

        // Optional reset: fully remove existing candidate by email
        if (options.reset) {
            const existing = await prisma.user.findUnique({
                where: { email: user.email },
            });
            if (existing) {
                await prisma.application.deleteMany({
                    where: { candidateId: existing.id },
                });
                await prisma.interviewSession.deleteMany({
                    where: { candidateId: existing.id },
                });
                await prisma.candidateProfile.deleteMany({
                    where: { userId: existing.id },
                });
                await prisma.user.delete({ where: { id: existing.id } });
            }
        }

        // 1) User + Profile
        const createdUser = await seedBasicCandidate(prisma, {
            name: user.name,
            email: user.email,
            image: user.image || "",
            jobTitle: user.jobTitle,
            location: user.location,
            bio: user.bio,
            skills: user.skills,
        });

        // 2) Application under company
        const app = await ensureApplicationForCompany(
            prisma,
            createdUser.id,
            application.companyId
        );

        // 3) Interview Session
        await prisma.interviewSession.deleteMany({
            where: { id: interviewSession.id },
        });
        const session = await prisma.interviewSession.create({
            data: {
                id: interviewSession.id,
                candidateId: createdUser.id,
                applicationId: app.id,
                videoUrl: interviewSession.videoUrl,
                duration: interviewSession.duration,
                status: interviewSession.status,
                ...((interviewSession as any).createdAt
                    ? {
                          createdAt: new Date(
                              (interviewSession as any).createdAt
                          ),
                      }
                    : {}),
            },
        });

        // 4) Telemetry
        await prisma.telemetryData.deleteMany({ where: { id: telemetry.id } });
        const telemetryRow = await prisma.telemetryData.create({
            data: {
                id: telemetry.id,
                interviewSessionId: session.id,
                matchScore: telemetry.matchScore,
                confidence: telemetry.confidence,
                story: telemetry.story,
                hasFairnessFlag: telemetry.hasFairnessFlag,
                persistenceFlow: telemetry.persistenceFlow as any,
                learningToAction: telemetry.learningToAction as any,
                confidenceCurve: telemetry.confidenceCurve as any,
            },
        });

        // 5) Workstyle (allow nulls/omissions)
        const wsUpdate: any = {};
        const wsCreate: any = {
            id: workstyleMetrics.id,
            telemetryDataId: telemetryRow.id,
        };
        const wsKeys = [
            "iterationSpeed",
            "debugLoops",
            "refactorCleanups",
            "aiAssistUsage",
        ] as const;
        for (const key of wsKeys) {
            const value = (workstyleMetrics as any)[key];
            if (value !== undefined) {
                wsUpdate[key] = value;
                wsCreate[key] = value;
            }
        }
        await prisma.workstyleMetrics.upsert({
            where: { telemetryDataId: telemetryRow.id },
            update: wsUpdate,
            create: wsCreate,
        });

        // 6) Gaps
        const gapAnalysis = await prisma.gapAnalysis.upsert({
            where: { telemetryDataId: telemetryRow.id },
            update: {},
            create: { telemetryDataId: telemetryRow.id },
        });
        await prisma.gap.deleteMany({
            where: { gapAnalysisId: gapAnalysis.id },
        });
        const severityToColor = (sev?: string) => {
            const s = (sev || "").toLowerCase();
            if (s.includes("major")) return "red";
            if (s.includes("moderate")) return "yellow";
            if (s.includes("minor")) return "yellow";
            return "blue";
        };
        for (const gap of gaps) {
            await prisma.gap.create({
                data: {
                    id: gap.id,
                    gapAnalysisId: gapAnalysis.id,
                    severity: gap.severity,
                    description: gap.description,
                    color: severityToColor(gap.severity),
                    evidenceLinks: gap.evidenceLinks,
                },
            });
        }

        // 7) Evidence clips
        await prisma.evidenceClip.deleteMany({
            where: { telemetryDataId: telemetryRow.id },
        });
        if (videoEvidence.length) {
            await prisma.evidenceClip.createMany({
                data: videoEvidence.map((clip) => ({
                    id: clip.id,
                    telemetryDataId: telemetryRow.id,
                    title: clip.title,
                    duration: 5,
                    description: `Evidence for ${clip.title}`,
                    startTime: clip.startTime ?? null,
                    thumbnailUrl: clip.thumbnailUrl,
                    category: clip.category as any,
                })),
            });
        }

        // 8) Chapters + captions
        await prisma.videoCaption.deleteMany({
            where: { videoChapterId: { in: videoChapters.map((c) => c.id) } },
        });
        await prisma.videoChapter.deleteMany({
            where: { telemetryDataId: telemetryRow.id },
        });
        for (const chapter of videoChapters) {
            await prisma.videoChapter.create({
                data: {
                    id: chapter.id,
                    telemetryDataId: telemetryRow.id,
                    title: chapter.title,
                    startTime: chapter.startTime,
                    endTime: chapter.endTime,
                    description: chapter.title,
                    thumbnailUrl: chapter.thumbnailUrl,
                },
            });
            if (chapter.captions?.length) {
                await prisma.videoCaption.createMany({
                    data: (chapter.captions as Caption[]).map((cap) => ({
                        id: cap.id,
                        videoChapterId: chapter.id,
                        text: cap.text,
                        startTime: cap.startTime,
                        endTime: cap.endTime,
                    })),
                });
            }
        }

        log.info(
            `Seeded candidate from ${path.basename(filePath)} → ${user.email}`
        );
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    const fileArg = process.argv.find((a) => a.startsWith("--file="));
    const file = fileArg ? fileArg.split("=")[1] : undefined;
    if (!file) {
        log.error(
            "Usage: tsx server/db-scripts/seed-candidate/seed-candidate-from-json.ts --file=path/to/file.json"
        );
        process.exit(1);
    }
    seedCandidateFromFile(file, { reset: true }).catch((e) => {
        log.error("❌ Error seeding from JSON:", e);
        process.exit(1);
    });
}
