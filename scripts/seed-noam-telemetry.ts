import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seedNoamTelemetry() {
    try {
        console.log("🌱 Starting Noam telemetry data seeding...");

        const hashedPassword = await bcrypt.hash("sfinx", 12);

        // 1. Create User
        const user = await prisma.user.upsert({
            where: { email: "noam@gmail.com" },
            update: {
                image: "/uploads/profiles/cmf7m2a0d0000sb9b4xc7l81k-1757125432914.jpeg",
                password: hashedPassword,
            },
            create: {
                id: "noam-user-id",
                name: "Noam Hoze",
                email: "noam@gmail.com",
                password: hashedPassword,
                role: "CANDIDATE",
                image: "/uploads/profiles/cmf7m2a0d0000sb9b4xc7l81k-1757125432914.jpeg",
            },
        });
        console.log("✅ User created:", user.id);

        // 2. Create Candidate Profile
        const candidateProfile = await prisma.candidateProfile.upsert({
            where: { userId: "noam-user-id" },
            update: {},
            create: {
                id: "noam-profile-id",
                userId: "noam-user-id",
                jobTitle: "Software Engineer",
                location: "Tel Aviv, Israel",
                bio: "Experienced React developer with strong problem-solving skills",
                skills: ["React", "TypeScript", "Node.js", "JavaScript"],
            },
        });
        console.log("✅ Candidate profile created:", candidateProfile.id);

        // 3. Get or create a company
        let company = await prisma.company.findFirst();
        if (!company) {
            company = await prisma.company.create({
                data: {
                    name: "TechCorp",
                    industry: "Technology",
                    locations: ["Tel Aviv"],
                    cultureTags: ["Innovation", "Collaboration"],
                    size: "MEDIUM",
                },
            });
        }

        // 4. Create Job
        const job = await prisma.job.upsert({
            where: { id: "sample-job-id" },
            update: {},
            create: {
                id: "sample-job-id",
                title: "Frontend Developer",
                type: "FULL_TIME",
                location: "Tel Aviv",
                description: "Building modern React applications",
                companyId: company.id,
            },
        });
        console.log("✅ Job created:", job.id);

        // 5. Create Application
        const application = await prisma.application.upsert({
            where: {
                candidateId_jobId: {
                    candidateId: "noam-user-id",
                    jobId: "sample-job-id",
                },
            },
            update: {},
            create: {
                id: "noam-application-id",
                candidateId: "noam-user-id",
                jobId: "sample-job-id",
                status: "INTERVIEWING",
            },
        });
        console.log("✅ Application created:", application.id);

        // 6. Create Interview Session
        const interviewSession = await prisma.interviewSession.upsert({
            where: { id: "noam-interview-session-id" },
            update: {},
            create: {
                id: "noam-interview-session-id",
                candidateId: "noam-user-id",
                applicationId: "noam-application-id",
                status: "COMPLETED",
                duration: 235,
            },
        });
        console.log("✅ Interview session created:", interviewSession.id);

        // 7. Create Telemetry Data
        const telemetryData = await prisma.telemetryData.upsert({
            where: { id: "noam-telemetry-id" },
            update: {},
            create: {
                id: "noam-telemetry-id",
                interviewSessionId: "noam-interview-session-id",
                matchScore: 92,
                confidence: "High",
                story: "Noam showcased excellent React proficiency by rapidly building a UserList component with clean API integration, proper error handling, and polished styling. They demonstrated methodical problem-solving and clean code practices throughout the session.",
                hasFairnessFlag: false,
            },
        });
        console.log("✅ Telemetry data created:", telemetryData.id);

        // 8. Create Workstyle Metrics
        const workstyleMetrics = await prisma.workstyleMetrics.upsert({
            where: { id: "noam-workstyle-id" },
            update: {},
            create: {
                id: "noam-workstyle-id",
                telemetryDataId: "noam-telemetry-id",
                iterationSpeed: 85,
                debugLoops: 75,
                refactorCleanups: 88,
                aiAssistUsage: 15,
            },
        });
        console.log("✅ Workstyle metrics created:", workstyleMetrics.id);

        // 9. Create Gap Analysis
        const gapAnalysis = await prisma.gapAnalysis.upsert({
            where: { id: "noam-gap-analysis-id" },
            update: {},
            create: {
                id: "noam-gap-analysis-id",
                telemetryDataId: "noam-telemetry-id",
            },
        });
        console.log("✅ Gap analysis created:", gapAnalysis.id);

        // 10. Create Gaps
        const gaps = await Promise.all([
            prisma.gap.upsert({
                where: { id: "noam-gap-1" },
                update: {},
                create: {
                    id: "noam-gap-1",
                    gapAnalysisId: "noam-gap-analysis-id",
                    severity: "Minor",
                    description: "Inconsistent CSS naming conventions",
                    color: "yellow",
                    evidenceLinks: [85, 145, 220],
                },
            }),
            prisma.gap.upsert({
                where: { id: "noam-gap-2" },
                update: {},
                create: {
                    id: "noam-gap-2",
                    gapAnalysisId: "noam-gap-analysis-id",
                    severity: "Minor",
                    description: "Limited test coverage for edge cases",
                    color: "yellow",
                    evidenceLinks: [95, 185],
                },
            }),
        ]);
        console.log("✅ Gaps created:", gaps.length);

        // 11. Create Evidence Clips
        const evidenceClips = await Promise.all([
            prisma.evidenceClip.upsert({
                where: { id: "noam-evidence-1" },
                update: {},
                create: {
                    id: "noam-evidence-1",
                    telemetryDataId: "noam-telemetry-id",
                    title: "Rapid UserList Implementation",
                    duration: 75,
                    description:
                        "Quick setup of UserList component with API integration and styling",
                    startTime: 75,
                },
            }),
            prisma.evidenceClip.upsert({
                where: { id: "noam-evidence-2" },
                update: {},
                create: {
                    id: "noam-evidence-2",
                    telemetryDataId: "noam-telemetry-id",
                    title: "Clean Error Handling",
                    duration: 45,
                    description:
                        "Implementation of loading and error states for API calls",
                    startTime: 120,
                },
            }),
        ]);
        console.log("✅ Evidence clips created:", evidenceClips.length);

        // 12. Create Video Chapters
        const videoChapters = await Promise.all([
            prisma.videoChapter.upsert({
                where: { id: "noam-chapter-1" },
                update: {},
                create: {
                    id: "noam-chapter-1",
                    telemetryDataId: "noam-telemetry-id",
                    title: "Session Setup & Introduction",
                    startTime: 0,
                    endTime: 75,
                    description:
                        "Initial setup, task briefing, and environment configuration",
                },
            }),
            prisma.videoChapter.upsert({
                where: { id: "noam-chapter-2" },
                update: {},
                create: {
                    id: "noam-chapter-2",
                    telemetryDataId: "noam-telemetry-id",
                    title: "UserList Component Development",
                    startTime: 75,
                    endTime: 165,
                    description:
                        "Building the UserList component with API integration and styling",
                },
            }),
            prisma.videoChapter.upsert({
                where: { id: "noam-chapter-3" },
                update: {},
                create: {
                    id: "noam-chapter-3",
                    telemetryDataId: "noam-telemetry-id",
                    title: "Testing & Final Polish",
                    startTime: 165,
                    endTime: 235,
                    description:
                        "Final testing, code cleanup, and session wrap-up",
                },
            }),
        ]);
        console.log("✅ Video chapters created:", videoChapters.length);

        // 13. Create Video Captions
        const captions = await Promise.all([
            // Chapter 1 captions
            prisma.videoCaption.upsert({
                where: { id: "noam-caption-1-1" },
                update: {},
                create: {
                    id: "noam-caption-1-1",
                    videoChapterId: "noam-chapter-1",
                    text: "Setting up development environment",
                    startTime: 5,
                    endTime: 20,
                },
            }),
            prisma.videoCaption.upsert({
                where: { id: "noam-caption-1-2" },
                update: {},
                create: {
                    id: "noam-caption-1-2",
                    videoChapterId: "noam-chapter-1",
                    text: "Reviewing project requirements",
                    startTime: 25,
                    endTime: 40,
                },
            }),
            prisma.videoCaption.upsert({
                where: { id: "noam-caption-1-3" },
                update: {},
                create: {
                    id: "noam-caption-1-3",
                    videoChapterId: "noam-chapter-1",
                    text: "Exploring codebase structure",
                    startTime: 45,
                    endTime: 65,
                },
            }),
            // Chapter 2 captions
            prisma.videoCaption.upsert({
                where: { id: "noam-caption-2-1" },
                update: {},
                create: {
                    id: "noam-caption-2-1",
                    videoChapterId: "noam-chapter-2",
                    text: "Planning component architecture",
                    startTime: 80,
                    endTime: 95,
                },
            }),
            prisma.videoCaption.upsert({
                where: { id: "noam-caption-2-2" },
                update: {},
                create: {
                    id: "noam-caption-2-2",
                    videoChapterId: "noam-chapter-2",
                    text: "Implementing API data fetching",
                    startTime: 100,
                    endTime: 115,
                },
            }),
            prisma.videoCaption.upsert({
                where: { id: "noam-caption-2-3" },
                update: {},
                create: {
                    id: "noam-caption-2-3",
                    videoChapterId: "noam-chapter-2",
                    text: "Adding loading and error states",
                    startTime: 120,
                    endTime: 135,
                },
            }),
            prisma.videoCaption.upsert({
                where: { id: "noam-caption-2-4" },
                update: {},
                create: {
                    id: "noam-caption-2-4",
                    videoChapterId: "noam-chapter-2",
                    text: "Styling responsive layout",
                    startTime: 140,
                    endTime: 155,
                },
            }),
            // Chapter 3 captions
            prisma.videoCaption.upsert({
                where: { id: "noam-caption-3-1" },
                update: {},
                create: {
                    id: "noam-caption-3-1",
                    videoChapterId: "noam-chapter-3",
                    text: "Running comprehensive tests",
                    startTime: 170,
                    endTime: 185,
                },
            }),
            prisma.videoCaption.upsert({
                where: { id: "noam-caption-3-2" },
                update: {},
                create: {
                    id: "noam-caption-3-2",
                    videoChapterId: "noam-chapter-3",
                    text: "Code cleanup and optimization",
                    startTime: 190,
                    endTime: 205,
                },
            }),
            prisma.videoCaption.upsert({
                where: { id: "noam-caption-3-3" },
                update: {},
                create: {
                    id: "noam-caption-3-3",
                    videoChapterId: "noam-chapter-3",
                    text: "Final code review",
                    startTime: 210,
                    endTime: 225,
                },
            }),
        ]);
        console.log("✅ Video captions created:", captions.length);

        console.log("🎉 Noam telemetry data seeding completed successfully!");
        console.log("📊 Total records created: 21");
        console.log("🔗 Noam's CPS URL: /cps?candidateId=noam-user-id");
    } catch (error) {
        console.error("❌ Error seeding Noam telemetry data:", error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the seed function
seedNoamTelemetry()
    .then(() => {
        console.log("✅ Seeding completed!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Seeding failed:", error);
        process.exit(1);
    });
