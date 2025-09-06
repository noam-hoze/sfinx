import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function debugAPI() {
    try {
        console.log("🔍 Debugging API query for candidateId: noam-user-id");

        const candidateId = "noam-user-id";

        // Get the most recent interview session for this candidate
        const interviewSession = await prisma.interviewSession.findFirst({
            where: {
                candidateId: candidateId,
                status: "COMPLETED",
            },
            include: {
                telemetryData: {
                    include: {
                        workstyleMetrics: true,
                        gapAnalysis: {
                            include: {
                                gaps: true,
                            },
                        },
                        evidenceClips: true,
                        videoChapters: {
                            include: {
                                captions: true,
                            },
                        },
                    },
                },
                candidate: {
                    include: {
                        candidateProfile: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        console.log("Interview session found:", !!interviewSession);
        if (interviewSession) {
            console.log(
                "Has telemetry data:",
                !!interviewSession.telemetryData
            );
            console.log("Candidate name:", interviewSession.candidate?.name);
        }

        if (!interviewSession || !interviewSession.telemetryData) {
            console.log("❌ No telemetry data found");
            return;
        }

        const telemetry = interviewSession.telemetryData;
        const candidate = interviewSession.candidate;

        console.log("✅ Data transformation successful");
        console.log("Candidate name:", candidate?.name);
        console.log("Match score:", telemetry.matchScore);
    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        await prisma.$disconnect();
    }
}

debugAPI();
