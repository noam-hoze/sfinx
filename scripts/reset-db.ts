#!/usr/bin/env tsx

import { PrismaClient, CompanySize, JobType } from "@prisma/client";
import { companiesData } from "../lib/data/job-search-data";

const prisma = new PrismaClient();

// Map mock data size to Prisma enum
const mapCompanySize = (size: string): CompanySize => {
    switch (size.toLowerCase()) {
        case "startup":
            return CompanySize.STARTUP;
        case "small":
            return CompanySize.SMALL;
        case "medium":
            return CompanySize.MEDIUM;
        case "large":
            return CompanySize.LARGE;
        case "enterprise":
            return CompanySize.ENTERPRISE;
        default:
            return CompanySize.MEDIUM;
    }
};

// Map mock data job type to Prisma enum
const mapJobType = (type: string): JobType => {
    switch (type.toLowerCase()) {
        case "full-time":
            return JobType.FULL_TIME;
        case "part-time":
            return JobType.PART_TIME;
        case "contract":
            return JobType.CONTRACT;
        default:
            return JobType.FULL_TIME;
    }
};

async function resetDatabase() {
    try {
        console.log("🗑️  Clearing existing data...");

        // Delete in reverse order of dependencies
        await prisma.job.deleteMany();
        await prisma.company.deleteMany();

        console.log("📝 Seeding companies and jobs...");

        for (const companyData of companiesData) {
            const company = await prisma.company.create({
                data: {
                    id: companyData.id,
                    name: companyData.name,
                    logo: companyData.logo,
                    industry: companyData.industry,
                    locations: companyData.locations,
                    cultureTags: companyData.cultureTags,
                    size: mapCompanySize(companyData.size),
                },
            });

            console.log(`✅ Created company: ${company.name}`);

            // Create jobs for this company
            for (const jobData of companyData.openRoles) {
                await prisma.job.create({
                    data: {
                        title: jobData.title,
                        type: mapJobType(jobData.type),
                        location: jobData.location,
                        salary: jobData.salary,
                        companyId: company.id,
                    },
                });
            }

            console.log(
                `   └─ Created ${companyData.openRoles.length} jobs for ${company.name}`
            );
        }

        console.log("🎉 Database reset and seeded successfully!");

        // Print summary
        const companyCount = await prisma.company.count();
        const jobCount = await prisma.job.count();
        console.log(`📊 Summary: ${companyCount} companies, ${jobCount} jobs`);
    } catch (error) {
        console.error("❌ Error resetting database:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

resetDatabase();
