import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const userId = (session?.user as any)?.id;

        const { searchParams } = new URL(request.url);
        const searchRole = searchParams.get("role") || "";
        const searchLocation = searchParams.get("location") || "";
        const searchCompany = searchParams.get("company") || "";

        // Fetch companies with their jobs
        const companies = await (prisma as any).company.findMany({
            include: {
                jobs: true,
            },
        });

        // Get user's applied company IDs if user is logged in
        let appliedCompanyIds: string[] = [];
        if (userId) {
            const applications = await (prisma as any).application.findMany({
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
            appliedCompanyIds = Array.from(
                new Set(
                    applications.map((app: any) => app.job.company.id as string)
                )
            );
        }

        // Apply filters
        const filteredCompanies = companies.filter((company: any) => {
            const roleMatch =
                !searchRole ||
                company.jobs.some((job: any) =>
                    job.title.toLowerCase().includes(searchRole.toLowerCase())
                );

            const locationMatch =
                !searchLocation ||
                company.locations.some((loc: string) =>
                    loc.toLowerCase().includes(searchLocation.toLowerCase())
                );

            const companyMatch =
                !searchCompany ||
                company.name
                    .toLowerCase()
                    .includes(searchCompany.toLowerCase()) ||
                company.industry
                    .toLowerCase()
                    .includes(searchCompany.toLowerCase());

            return roleMatch && locationMatch && companyMatch;
        });

        // Add applied status to each company
        const companiesWithAppliedStatus = filteredCompanies.map(
            (company: any) => ({
                ...company,
                hasApplied: appliedCompanyIds.includes(company.id),
            })
        );

        return NextResponse.json({
            companies: companiesWithAppliedStatus,
            total: companiesWithAppliedStatus.length,
        });
    } catch (error) {
        console.error("Error fetching companies:", error);
        return NextResponse.json(
            { error: `Failed to fetch companies: ${error.message || error}` },
            { status: 500 }
        );
    }
}
