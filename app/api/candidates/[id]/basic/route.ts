import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "app/shared/services/auth";
import { log } from "app/shared/services";

const prisma = new PrismaClient();

type RouteContext = {
    params: Promise<{ id: string }>;
};

/**
 * GET basic candidate info (name, latest match score).
 */
export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id: candidateId } = await context.params;

        const candidate = await prisma.user.findUnique({
            where: { id: candidateId },
            include: {
                interviewSessions: {
                    include: {
                        telemetryData: true,
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                    take: 1,
                },
            },
        });

        if (!candidate) {
            return NextResponse.json(
                { error: "Candidate not found" },
                { status: 404 }
            );
        }

        const latestSession = candidate.interviewSessions[0];
        const matchScore = latestSession?.telemetryData?.matchScore || 0;

        return NextResponse.json({
            id: candidate.id,
            name: candidate.name || "Unknown",
            score: matchScore,
        });
    } catch (error) {
        console.error('Error fetching candidate basic info:', error);
        return NextResponse.json(
            { error: 'Failed to fetch candidate info' },
            { status: 500 }
        );
    }
}
