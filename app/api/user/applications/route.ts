import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "app/shared/services/auth";
import { prisma } from "app/shared/services";
import { log } from "app/shared/services";

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!(session?.user as any)?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const userId = (session!.user as any).id;

        // Get all applications for this user
        const applications = await prisma.application.findMany({
            where: {
                candidateId: userId,
            },
            include: {
                job: {
                    include: {
                        company: true,
                    },
                },
            },
        });

        // Extract unique company IDs from applications
        const appliedCompanyIds = [
            ...new Set(applications.map((app) => app.job.company.id)),
        ];

        return NextResponse.json({
            appliedCompanyIds,
            total: appliedCompanyIds.length,
        });
    } catch (error) {
        log.error("Error fetching user applications:", error);
        return NextResponse.json(
            {
                error: `Failed to fetch applications: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            },
            { status: 500 }
        );
    }
}
