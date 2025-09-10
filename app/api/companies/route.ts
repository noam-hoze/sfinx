import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../services/auth";
import { prisma } from "../../../services";
import { logger } from "../../../services";

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

        // Get user's applied company/job IDs if user is logged in
        let appliedCompanyIds: string[] = [];
        let appliedJobIds: string[] = [];
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
            appliedJobIds = Array.from(
                new Set(applications.map((app: any) => app.job.id as string))
            );
        }

        // Normalize filters
        const roleFilter = (searchRole || "").toLowerCase();
        const locationFilter = (searchLocation || "").toLowerCase();
        const companyFilter = (searchCompany || "").toLowerCase();

        // First, filter each company's jobs by role and job.location
        const companiesWithFilteredJobs = companies.map((company: any) => {
            const filteredJobs = company.jobs.filter((job: any) => {
                const roleOk =
                    !roleFilter || job.title.toLowerCase().includes(roleFilter);
                const locationOk =
                    !locationFilter ||
                    (job.location || "").toLowerCase().includes(locationFilter);
                return roleOk && locationOk;
            });
            return { ...company, jobs: filteredJobs };
        });

        // Then, filter companies: must match company filter and (have jobs if role/location provided)
        const filteredCompanies = companiesWithFilteredJobs.filter(
            (company: any) => {
                const companyMatch =
                    !companyFilter ||
                    company.name.toLowerCase().includes(companyFilter) ||
                    company.industry.toLowerCase().includes(companyFilter);

                const hasMatchingJobs =
                    company.jobs.length > 0 || (!roleFilter && !locationFilter);

                return companyMatch && hasMatchingJobs;
            }
        );

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
            appliedCompanyIds,
            appliedJobIds,
        });
    } catch (error) {
        logger.error("Error fetching companies:", error);
        return NextResponse.json(
            {
                error: `Failed to fetch companies: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            },
            { status: 500 }
        );
    }
}
