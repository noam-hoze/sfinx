#!/usr/bin/env tsx

import { PrismaClient, CompanySize, JobType, UserRole } from "@prisma/client";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { log } from "app/shared/services";

// Import seed functions
import { seedGal } from "./seed-candidate/seed-gal";
import { seedGalSession2 } from "./seed-candidate/seed-gal-session2";
import { seedGalSession3 } from "./seed-candidate/seed-gal-session3";
import { seedGalSession4 } from "./seed-candidate/seed-gal-session4";
import { seedGalSession5 } from "./seed-candidate/seed-gal-session5";
import { seedMark } from "./seed-candidate/seed-mark";

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
        const interviewScriptPath = path.join(
            process.cwd(),
            "server/interviews/meta/frontend-engineer/interviewScript.json"
        );
        const companiesPath = path.join(
            process.cwd(),
            "server/db-scripts/data/companies.json"
        );
        const companiesData = JSON.parse(
            fs.readFileSync(companiesPath, "utf-8")
        );
        const interviewScript = JSON.parse(
            fs.readFileSync(interviewScriptPath, "utf-8")
        );
        const codingPrompt: string | undefined =
            interviewScript?.codingChallenge?.prompt;
        if (!codingPrompt) {
            throw new Error("Missing coding prompt in interview script JSON");
        }
        log.info("Clearing existing data...");

        // Delete in reverse order of dependencies
        await prisma.job.deleteMany();
        await prisma.interviewContent.deleteMany();
        await prisma.company.deleteMany();
        await prisma.companyProfile.deleteMany();
        await prisma.candidateProfile.deleteMany();
        await prisma.user.deleteMany();

        log.info("Seeding companies, users, and jobs...");

        // Hash the password once for all users
        const hashedPassword = await bcrypt.hash("sfinx", 12);

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

            log.info(`Created company: ${company.name}`);

            // Create user account for company manager
            const managerEmail = `manager@${companyData.name
                .toLowerCase()
                .replace(/\s+/g, "")}.com`;
            const user = await prisma.user.create({
                data: {
                    id: `manager-${companyData.id}`,
                    name: `${companyData.name} Manager`,
                    email: managerEmail,
                    password: hashedPassword,
                    role: UserRole.COMPANY,
                    image:
                        companyData.id === "meta"
                            ? "/uploads/profiles/meta-profile.png"
                            : undefined,
                },
            });

            // Create company profile
            await prisma.companyProfile.create({
                data: {
                    userId: user.id,
                    companyName: companyData.name,
                    companySize: mapCompanySize(companyData.size),
                    location: companyData.locations[0], // Use first location
                    bio: `Leading company in ${companyData.industry}`,
                    website: `https://www.${companyData.name
                        .toLowerCase()
                        .replace(/\s+/g, "")}.com`,
                    industry: companyData.industry,
                    description: `${companyData.name} is a ${
                        companyData.size
                    } company focused on ${
                        companyData.industry
                    }. Our culture emphasizes ${companyData.cultureTags.join(
                        ", "
                    )}.`,
                    benefits: companyData.cultureTags,
                },
            });

            log.info(`   └─ Created manager account: ${managerEmail}`);

            // Create jobs for this company
            for (const jobData of companyData.openRoles) {
                await prisma.job.create({
                    data: {
                        id: `${companyData.id}-${jobData.title
                            .toLowerCase()
                            .replace(/\s+/g, "-")}`,
                        title: jobData.title,
                        type: mapJobType(jobData.type),
                        location: jobData.location,
                        salary: jobData.salary,
                        companyId: company.id,
                    },
                });
            }

            log.info(`   └─ Created ${companyData.openRoles.length} jobs for ${company.name}`);
        }

        log.info("Seeding shared interview content for frontend roles...");
        const interviewContent = await prisma.interviewContent.upsert({
            where: {
                id: "shared-frontend-interview",
            },
            update: {
                backgroundQuestion: interviewScript.backgroundQuestion,
                codingPrompt,
                codingTemplate: interviewScript?.codingChallenge?.template,
                codingAnswer: interviewScript?.codingChallenge?.answer,
            },
            create: {
                id: "shared-frontend-interview",
                backgroundQuestion: interviewScript.backgroundQuestion,
                codingPrompt,
                codingTemplate: interviewScript?.codingChallenge?.template,
                codingAnswer: interviewScript?.codingChallenge?.answer,
            },
        });
        const frontendJobUpdate = await prisma.job.updateMany({
            where: {
                title: "Frontend Engineer",
            },
            data: {
                interviewContentId: interviewContent.id,
            },
        });
        if (frontendJobUpdate.count === 0) {
            throw new Error("No Frontend Engineer jobs found to attach interview content");
        }
        log.info(
            `Linked interview content to ${frontendJobUpdate.count} Frontend Engineer jobs`
        );

        log.info("Database reset and seeded successfully!");

        // Create additional candidates using existing seed scripts
        await seedGal();
        await seedGalSession2();
        await seedGalSession3();
        await seedGalSession4();
        await seedGalSession5();
        await seedMark();

        // Print summary
        const companyCount = await prisma.company.count();
        const jobCount = await prisma.job.count();
        const userCount = await prisma.user.count();
        log.info(`Summary: ${companyCount} companies, ${userCount} users, ${jobCount} jobs`);
    } catch (error) {
        log.error("❌ Error resetting database:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

resetDatabase();
