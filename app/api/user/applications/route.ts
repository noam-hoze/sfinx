import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";

const prisma = new PrismaClient();

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
        console.error("Error fetching user applications:", error);
        return NextResponse.json(
            { error: "Failed to fetch applications" },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
}
