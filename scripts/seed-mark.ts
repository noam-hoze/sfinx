#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";
import { seedBasicCandidate, ensureApplicationForCompany } from "./seed-utils";

const prisma = new PrismaClient();

export async function seedMark() {
    try {
        console.log("👤 Creating Mark candidate user...");
        const user = await seedBasicCandidate(prisma, {
            name: "Mark",
            email: "mark@gmail.com",
            image: "/uploads/profiles/mark-profile.jpeg",
            jobTitle: "Frontend Developer",
            location: "Haifa, Israel",
            bio: "A skilled frontend developer.",
            skills: ["React", "Vue", "CSS"],
        });

        // 1) Ensure Mark has an application under Meta
        const application = await ensureApplicationForCompany(
            prisma,
            user.id,
            "meta"
        );

        // 2) Locate Mark's latest interview session (if any)
        const mark = await prisma.user.findUnique({
            where: { email: "mark@gmail.com" },
            select: { id: true },
        });

        if (!mark) {
            console.warn("⚠️ Mark user not found; skipping chapters.");
            return;
        }

        let session = await prisma.interviewSession.findFirst({
            where: { candidateId: mark.id },
            orderBy: { startedAt: "desc" },
        });

        if (!session) {
            // Create a new interview session linked to Mark's Meta application
            session = await prisma.interviewSession.create({
                data: {
                    candidateId: mark.id,
                    applicationId: application.id,
                    videoUrl: "uploads/recordings/mark-heavy-ai-usage.mp4",
                    duration: 118,
                    status: "COMPLETED",
                },
            });
            console.log("✅ Created Mark interview session:", session.id);
        }

        // 3) Ensure a TelemetryData row exists for the session
        let telemetry = await prisma.telemetryData.findUnique({
            where: { interviewSessionId: session.id },
        });

        if (!telemetry) {
            telemetry = await prisma.telemetryData.create({
                data: {
                    interviewSessionId: session.id,
                    matchScore: 25,
                    confidence: "Low",
                    story: "Mark completed a short interview with several coding iterations.",
                    hasFairnessFlag: false,
                },
            });
            console.log("✅ Created telemetry for Mark session:", telemetry.id);
        }

        // Optional: attach video URL and duration on the session if available
        try {
            await prisma.interviewSession.update({
                where: { id: session.id },
                data: {
                    videoUrl: "uploads/recordings/mark-heavy-ai-usage.mp4",
                    duration: 118,
                },
            });
        } catch (_) {}

        // 4) Seed video chapters (replace any existing chapters for this telemetry)
        await prisma.videoChapter.deleteMany({
            where: { telemetryDataId: telemetry.id },
        });

        const chapters = [
            {
                id: "mark-chapter-1",
                telemetryDataId: telemetry.id,
                title: "Introduction",
                startTime: 0,
                endTime: 32,
                description: "Introduction",
            },
            {
                id: "mark-chapter-2",
                telemetryDataId: telemetry.id,
                title: "Getting solution from ChatGPT",
                startTime: 32,
                endTime: 73,
                description: "Getting solution from ChatGPT",
            },
            {
                id: "mark-chapter-3",
                telemetryDataId: telemetry.id,
                title: "I don't know",
                startTime: 73,
                endTime: 96,
                description: "First iteration",
            },
            {
                id: "mark-chapter-4",
                telemetryDataId: telemetry.id,
                title: "1st iteration",
                startTime: 96,
                endTime: 106,
                description: "1st iteration",
            },
            {
                id: "mark-chapter-5",
                telemetryDataId: telemetry.id,
                title: "2nd iteration",
                startTime: 106,
                endTime: 118,
                description: "2nd iteration",
            },
            {
                id: "mark-chapter-6",
                telemetryDataId: telemetry.id,
                title: "3rd iteration",
                startTime: 118,
                endTime: 135,
                description: "3rd iteration",
            },
        ];

        await prisma.videoChapter.createMany({ data: chapters });
        console.log("🎬 Mark chapters seeded:", chapters.length);

        // 5) Seed captions aligned to chapters by time
        await prisma.videoCaption.createMany({
            data: [
                {
                    id: "mark-caption-3-1",
                    videoChapterId: "mark-chapter-3",
                    text: "Using ChatGPT",
                    startTime: 75, // 1:15
                    endTime: 80,
                },
                {
                    id: "mark-caption-3-2",
                    videoChapterId: "mark-chapter-3",
                    text: "The user doesn't not know how to explain his usage of AI",
                    startTime: 82, //1:22
                    endTime: 92,
                },
                {
                    id: "mark-caption-6-1",
                    videoChapterId: "mark-chapter-4",
                    text: "Checking ChatGPT's solution",
                    startTime: 96, // 1:36
                    endTime: 100,
                },
                {
                    id: "mark-caption-4-1",
                    videoChapterId: "mark-chapter-4",
                    text: "Infers right correction from error message",
                    startTime: 101, // 1:41
                    endTime: 104,
                },
                {
                    id: "mark-caption-5-1",
                    videoChapterId: "mark-chapter-5",
                    text: "Infers right correction from errors message",
                    startTime: 111, // 1:51
                    endTime: 115,
                },
                {
                    id: "mark-caption-7-1",
                    videoChapterId: "mark-chapter-1",
                    text: "Getting solution from ChatGPT",
                    startTime: 44, // 0:44
                    endTime: 51,
                },
            ],
        });
        console.log("💬 Mark captions seeded: 3");

        // 6) Workstyle metrics and evidence links
        // Iteration Speed: 85; AI Assist Usage: 100
        await prisma.workstyleMetrics.upsert({
            where: { telemetryDataId: telemetry.id },
            update: {
                iterationSpeed: 85,
                aiAssistUsage: 100,
                debugLoops: 0,
                refactorCleanups: 0,
            },
            create: {
                telemetryDataId: telemetry.id,
                iterationSpeed: 85,
                debugLoops: 0,
                refactorCleanups: 0,
                aiAssistUsage: 100,
            },
        });

        // Replace existing evidence clips for this telemetry
        await prisma.evidenceClip.deleteMany({
            where: { telemetryDataId: telemetry.id },
        });

        await prisma.evidenceClip.createMany({
            data: [
                {
                    id: "mark-iter-88",
                    telemetryDataId: telemetry.id,
                    title: "Iteration Speed",
                    duration: 4,
                    description: "Iteration marker at 1:28",
                    startTime: 88,
                    category: "ITERATION_SPEED" as any,
                },
                {
                    id: "mark-iter-100",
                    telemetryDataId: telemetry.id,
                    title: "Iteration Speed",
                    duration: 4,
                    description: "Iteration marker at 1:40",
                    startTime: 100,
                    category: "ITERATION_SPEED" as any,
                },
                {
                    id: "mark-iter-111",
                    telemetryDataId: telemetry.id,
                    title: "Iteration Speed",
                    duration: 4,
                    description: "Iteration marker at 1:51",
                    startTime: 111,
                    category: "ITERATION_SPEED" as any,
                },
                {
                    id: "mark-ai-44",
                    telemetryDataId: telemetry.id,
                    title: "AI Assist Usage",
                    duration: 4,
                    description: "AI assist usage marker at 0:44",
                    startTime: 44,
                    category: "AI_ASSIST_USAGE" as any,
                },
            ],
        });
        console.log("📎 Mark workstyle & evidence seeded.");

        // 7) Gap analysis: Major issue - lack of understanding of ChatGPT's solution
        const gapAnalysis = await prisma.gapAnalysis.upsert({
            where: { telemetryDataId: telemetry.id },
            update: {},
            create: { telemetryDataId: telemetry.id },
        });

        await prisma.gap.deleteMany({
            where: { gapAnalysisId: gapAnalysis.id },
        });
        await prisma.gap.create({
            data: {
                id: "mark-gap-1",
                gapAnalysisId: gapAnalysis.id,
                severity: "Major",
                description: "Lack of understanding of ChatGPT's solution",
                color: "red",
                evidenceLinks: [82], // 1:22
            },
        });
        console.log(
            "⚠️ Mark gap seeded: Major - lack of understanding of ChatGPT's solution"
        );

        console.log("📝 Added extra caption at 1:23");

        // 9) Learning-to-Action timeline: show action only when understanding errors (1:40, 1:50)
        await prisma.telemetryData.update({
            where: { id: telemetry.id },
            data: {
                learningToAction: [
                    { time: "0:00", value: 0, timestamp: 0, color: "#94a3b8" },
                    { time: "1:00", value: 0, timestamp: 60, color: "#94a3b8" },
                    { time: "1:20", value: 0, timestamp: 80, color: "#94a3b8" },
                    {
                        time: "1:42",
                        value: 1,
                        timestamp: 102,
                        color: "#3b82f6",
                    },
                    {
                        time: "1:51",
                        value: 1,
                        timestamp: 111,
                        color: "#3b82f6",
                    },
                ] as any,
            },
        });

        // 10) Confidence building curve: 1s until 1:24, then drop to 0 at 1:24 with link + persistence flow
        await prisma.telemetryData.update({
            where: { id: telemetry.id },
            data: {
                confidenceCurve: [
                    {
                        time: "0:00",
                        confidence: 1,
                        timestamp: 0,
                        color: "#3b82f6",
                    },
                    {
                        time: "1:00",
                        confidence: 1,
                        timestamp: 60,
                        color: "#3b82f6",
                    },
                    {
                        time: "1:20",
                        confidence: 1,
                        timestamp: 80,
                        color: "#3b82f6",
                    },
                    {
                        time: "1:24",
                        confidence: 0,
                        timestamp: 84,
                        color: "#ef4444",
                        link: 84,
                    },
                ] as any,
                // Persistence flow: retries caused by preview tab errors
                persistenceFlow: [
                    {
                        name: "0:38",
                        attempts: 0,
                        timestamp: 38,
                        color: "#94a3b8",
                    },
                    {
                        name: "1:24",
                        attempts: 1,
                        timestamp: 84,
                        color: "#ef4444",
                    },
                    {
                        name: "1:40",
                        attempts: 3,
                        timestamp: 100,
                        color: "#eab308",
                    },
                    {
                        name: "1:50",
                        attempts: 5,
                        timestamp: 110,
                        color: "#22c55e",
                    },
                ] as any,
            },
        });
        console.log("📈 Mark learning-to-action and confidence curve seeded.");
    } catch (error) {
        console.error("❌ Error creating Mark candidate:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}
