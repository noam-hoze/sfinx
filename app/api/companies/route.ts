import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
    try {
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

        return NextResponse.json({
            companies: filteredCompanies,
            total: filteredCompanies.length,
        });
    } catch (error) {
        console.error("Error fetching companies:", error);
        return NextResponse.json(
            { error: "Failed to fetch companies" },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
}
