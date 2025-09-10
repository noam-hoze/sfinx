#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";
import { seedBasicCandidate, ensureApplicationForCompany } from "./seed-utils";

const prisma = new PrismaClient();

export async function seedGal() {
    try {
        console.log("👤 Creating Gal candidate user...");

        // 1-2. Create User and Candidate Profile (shared helper)
        const user = await seedBasicCandidate(prisma, {
            name: "Gal",
            email: "gal@gmail.com",
            image: "/uploads/profiles/gal-profile.jpeg",
            jobTitle: "Software Engineer",
            location: "Tel Aviv, Israel",
            bio: "A talented software engineer.",
            skills: ["React", "TypeScript", "Node.js"],
        });

        // 3/5. Ensure Meta application exists
        const application = await ensureApplicationForCompany(
            prisma,
            user.id,
            "meta"
        );
        console.log("✅ Application created:", application.id);

        // 6. Create Interview Session
        const interviewSession = await prisma.interviewSession.create({
            data: {
                id: "gal-interview-session-id",
                candidateId: user.id,
                applicationId: application.id,
                videoUrl: "uploads/recordings/gal-medium.mp4",
                status: "COMPLETED",
                duration: 210,
            },
        });
        console.log("✅ Interview session created:", interviewSession.id);

        // 7. Create Telemetry Data
        const telemetryData = await prisma.telemetryData.create({
            data: {
                id: "gal-telemetry-id",
                interviewSessionId: "gal-interview-session-id",
                matchScore: 85,
                confidence: "Medium",
                story: "Gal demonstrated solid problem-solving and built a functional UserList with API integration and basic states. There is room to improve error handling depth and UI polish.",
                hasFairnessFlag: false,
                persistenceFlow: [
                    {
                        name: "0:30",
                        attempts: 1,
                        timestamp: 30,
                        color: "#ef4444",
                    },
                    {
                        name: "1:10",
                        attempts: 2,
                        timestamp: 70,
                        color: "#ef4444",
                    },
                    {
                        name: "2:00",
                        attempts: 3,
                        timestamp: 120,
                        color: "#f97316",
                    },
                    {
                        name: "2:40",
                        attempts: 4,
                        timestamp: 160,
                        color: "#eab308",
                    },
                    {
                        name: "3:20",
                        attempts: 5,
                        timestamp: 200,
                        color: "#22c55e",
                    },
                ],
                learningToAction: [
                    {
                        time: "0:00",
                        value: 0.6,
                        timestamp: 0,
                        color: "#3b82f6",
                    },
                    {
                        time: "0:45",
                        value: 0.9,
                        timestamp: 45,
                        color: "#3b82f6",
                    },
                    {
                        time: "1:30",
                        value: 1.3,
                        timestamp: 90,
                        color: "#eab308",
                    },
                    {
                        time: "2:15",
                        value: 1.7,
                        timestamp: 135,
                        color: "#eab308",
                    },
                    {
                        time: "3:00",
                        value: 2.1,
                        timestamp: 180,
                        color: "#22c55e",
                    },
                ],
                confidenceCurve: [
                    {
                        time: "0:00",
                        confidence: 20,
                        timestamp: 0,
                        color: "#ef4444",
                    },
                    {
                        time: "0:45",
                        confidence: 35,
                        timestamp: 45,
                        color: "#ef4444",
                    },
                    {
                        time: "1:30",
                        confidence: 55,
                        timestamp: 90,
                        color: "#eab308",
                    },
                    {
                        time: "2:15",
                        confidence: 70,
                        timestamp: 135,
                        color: "#eab308",
                    },
                    {
                        time: "3:00",
                        confidence: 82,
                        timestamp: 180,
                        color: "#22c55e",
                    },
                ],
            } as any,
        });
        console.log("✅ Telemetry data created:", telemetryData.id);

        // 8. Create Workstyle Metrics
        const workstyleMetrics = await prisma.workstyleMetrics.create({
            data: {
                id: "gal-workstyle-id",
                telemetryDataId: "gal-telemetry-id",
                iterationSpeed: 90,
                debugLoops: 25,
                refactorCleanups: 74,
                aiAssistUsage: 0,
            },
        });
        console.log("✅ Workstyle metrics created:", workstyleMetrics.id);

        // 9. Create Gap Analysis
        const gapAnalysis = await prisma.gapAnalysis.create({
            data: {
                id: "gal-gap-analysis-id",
                telemetryDataId: "gal-telemetry-id",
            },
        });
        console.log("✅ Gap analysis created:", gapAnalysis.id);

        // 10. Create Gaps
        const gaps = await Promise.all([
            prisma.gap.create({
                data: {
                    id: "gal-gap-1",
                    gapAnalysisId: "gal-gap-analysis-id",
                    severity: "Minor",
                    description:
                        "Missing edge-case handling in fetch error states",
                    color: "yellow",
                    evidenceLinks: [80, 150],
                },
            }),
            prisma.gap.create({
                data: {
                    id: "gal-gap-2",
                    gapAnalysisId: "gal-gap-analysis-id",
                    severity: "Moderate",
                    description:
                        "UI polish and accessibility improvements needed",
                    color: "yellow",
                    evidenceLinks: [95, 185, 205],
                },
            }),
        ]);
        console.log("✅ Gaps created:", gaps.length);

        // 11. Create Evidence Clips
        const evidenceClips = await Promise.all([
            prisma.evidenceClip.create({
                data: {
                    id: "gal-evidence-1",
                    telemetryDataId: "gal-telemetry-id",
                    title: "Initial Setup & API Wiring",
                    duration: 60,
                    description:
                        "Set up UserList and connected to JSONPlaceholder API",
                    startTime: 60,
                    category: "ITERATION_SPEED",
                } as any,
            }),
            prisma.evidenceClip.create({
                data: {
                    id: "gal-evidence-2",
                    telemetryDataId: "gal-telemetry-id",
                    title: "State Management & Error Handling",
                    duration: 40,
                    description:
                        "Implemented loading and error state transitions",
                    startTime: 120,
                    category: "DEBUG_LOOP",
                } as any,
            }),
        ]);
        console.log("✅ Evidence clips created:", evidenceClips.length);

        // 12. Create Video Chapters
        const videoChapters = await Promise.all([
            prisma.videoChapter.create({
                data: {
                    id: "gal-chapter-1",
                    telemetryDataId: "gal-telemetry-id",
                    title: "Session Setup & Introduction",
                    startTime: 0,
                    endTime: 70,
                    description:
                        "Initial setup, task briefing, and environment configuration",
                },
            }),
            prisma.videoChapter.create({
                data: {
                    id: "gal-chapter-2",
                    telemetryDataId: "gal-telemetry-id",
                    title: "UserList Component Development",
                    startTime: 70,
                    endTime: 160,
                    description:
                        "Building the UserList component with API integration and styling",
                },
            }),
            prisma.videoChapter.create({
                data: {
                    id: "gal-chapter-3",
                    telemetryDataId: "gal-telemetry-id",
                    title: "Testing & Final Polish",
                    startTime: 160,
                    endTime: 210,
                    description:
                        "Final testing, code cleanup, and session wrap-up",
                },
            }),
        ]);
        console.log("✅ Video chapters created:", videoChapters.length);

        // 13. Create Video Captions
        const captions = await Promise.all([
            // Chapter 1 captions
            prisma.videoCaption.create({
                data: {
                    id: "gal-caption-1-1",
                    videoChapterId: "gal-chapter-1",
                    text: "Setting up development environment",
                    startTime: 5,
                    endTime: 20,
                },
            }),
            prisma.videoCaption.create({
                data: {
                    id: "gal-caption-1-2",
                    videoChapterId: "gal-chapter-1",
                    text: "Reviewing project requirements",
                    startTime: 25,
                    endTime: 40,
                },
            }),
            prisma.videoCaption.create({
                data: {
                    id: "gal-caption-1-3",
                    videoChapterId: "gal-chapter-1",
                    text: "Exploring codebase structure",
                    startTime: 45,
                    endTime: 65,
                },
            }),
            // Chapter 2 captions
            prisma.videoCaption.create({
                data: {
                    id: "gal-caption-2-1",
                    videoChapterId: "gal-chapter-2",
                    text: "Planning component architecture",
                    startTime: 80,
                    endTime: 95,
                },
            }),
            prisma.videoCaption.create({
                data: {
                    id: "gal-caption-2-2",
                    videoChapterId: "gal-chapter-2",
                    text: "Implementing API data fetching",
                    startTime: 100,
                    endTime: 115,
                },
            }),
            prisma.videoCaption.create({
                data: {
                    id: "gal-caption-2-3",
                    videoChapterId: "gal-chapter-2",
                    text: "Adding loading and error states",
                    startTime: 120,
                    endTime: 135,
                },
            }),
            prisma.videoCaption.create({
                data: {
                    id: "gal-caption-2-4",
                    videoChapterId: "gal-chapter-2",
                    text: "Styling responsive layout",
                    startTime: 140,
                    endTime: 155,
                },
            }),
            // Chapter 3 captions
            prisma.videoCaption.create({
                data: {
                    id: "gal-caption-3-1",
                    videoChapterId: "gal-chapter-3",
                    text: "Running comprehensive tests",
                    startTime: 170,
                    endTime: 185,
                },
            }),
            prisma.videoCaption.create({
                data: {
                    id: "gal-caption-3-2",
                    videoChapterId: "gal-chapter-3",
                    text: "Code cleanup and optimization",
                    startTime: 190,
                    endTime: 205,
                },
            }),
            prisma.videoCaption.create({
                data: {
                    id: "gal-caption-3-3",
                    videoChapterId: "gal-chapter-3",
                    text: "Final code review",
                    startTime: 210,
                    endTime: 225,
                },
            }),
        ]);
        console.log("✅ Video captions created:", captions.length);

        console.log("🎉 Gal telemetry data seeding completed successfully!");
        console.log("📊 Total records created: 21");
        console.log(`🔗 Gal's CPS URL: /cps?candidateId=${user.id}`);
    } catch (error) {
        console.error("❌ Error creating Gal candidate:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}
