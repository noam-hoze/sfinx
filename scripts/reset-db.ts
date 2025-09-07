#!/usr/bin/env tsx

import { PrismaClient, CompanySize, JobType, UserRole } from "@prisma/client";
import { companiesData } from "../lib/data/job-search-data";
import { noamTelemetryData } from "../lib/data/telemetry-data";
import bcrypt from "bcryptjs";

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
        await prisma.companyProfile.deleteMany();
        await prisma.candidateProfile.deleteMany();
        await prisma.user.deleteMany();

        console.log("📝 Seeding companies, users, and jobs...");

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

            console.log(`✅ Created company: ${company.name}`);

            // Create user account for company manager
            const managerEmail = `manager@${companyData.name
                .toLowerCase()
                .replace(/\s+/g, "")}.com`;
            const user = await prisma.user.create({
                data: {
                    name: `${companyData.name} Manager`,
                    email: managerEmail,
                    password: hashedPassword,
                    role: UserRole.COMPANY,
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

            console.log(`   └─ Created manager account: ${managerEmail}`);

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

        // Create test candidate user
        console.log("👤 Creating test candidate user...");
        const testCandidate = await prisma.user.create({
            data: {
                name: "Noam Hoze",
                email: "noam.hoze@gmail.com",
                password: hashedPassword, // Uses same hashed password "sfinx"
                role: UserRole.CANDIDATE,
                image: "/uploads/profiles/cmf7m2a0d0000sb9b4xc7l81k-1757125432914.jpeg",
            },
        });

        // Create candidate profile
        await prisma.candidateProfile.create({
            data: {
                userId: testCandidate.id,
                jobTitle: "Software Engineer",
                location: "Tel Aviv, Israel",
                bio: "Experienced software engineer passionate about building great products.",
                linkedin: "https://linkedin.com/in/noamhoze",
                github: "https://github.com/noamhoze",
                experience: "3-5 years",
                skills: [
                    "JavaScript",
                    "TypeScript",
                    "React",
                    "Node.js",
                    "Python",
                ],
            },
        });

        console.log(`✅ Created test candidate: ${testCandidate.email}`);

        // Find a job at "Meta" to apply to
        const metaJob = await prisma.job.findFirst({
            where: {
                company: {
                    name: "Meta",
                },
            },
        });

        if (!metaJob) {
            console.error(
                "Could not find any jobs at Meta to create an application for."
            );
            process.exit(1);
        }

        console.log(
            `👤 Creating application and interview session for ${testCandidate.name} at Meta...`
        );

        // Create Application
        const application = await prisma.application.create({
            data: {
                candidateId: testCandidate.id,
                jobId: metaJob.id,
                status: "PENDING",
            },
        });

        // Create Interview Session
        const interviewSession = await prisma.interviewSession.create({
            data: {
                candidateId: testCandidate.id,
                applicationId: application.id,
                videoUrl: "uploads/recordings/recording-1757254076264.mp4",
                status: "IN_PROGRESS",
            },
        });

        // --- Seeding Data for Telemetry ---
        const {
            candidate: candidateInfo,
            gaps,
            evidence,
            chapters,
            workstyle,
            hasFairnessFlag,
        } = noamTelemetryData;

        // Create Telemetry Data with all nested relations
        await prisma.telemetryData.create({
            data: {
                interviewSessionId: interviewSession.id,
                matchScore: candidateInfo.matchScore,
                confidence: candidateInfo.confidence,
                story: candidateInfo.story,
                hasFairnessFlag,
                workstyleMetrics: {
                    create: {
                        iterationSpeed: workstyle.iterationSpeed.value,
                        debugLoops: workstyle.debugLoops.value,
                        refactorCleanups: workstyle.refactorCleanups.value,
                        aiAssistUsage: workstyle.aiAssistUsage.value,
                    },
                },
                gapAnalysis: {
                    create: {
                        gaps: {
                            create: gaps.gaps.map((g) => ({
                                severity: g.severity,
                                description: g.description,
                                color: g.color,
                                evidenceLinks: g.evidenceLinks,
                            })),
                        },
                    },
                },
                evidenceClips: {
                    create: evidence.map((e) => ({
                        title: e.title,
                        description: e.description,
                        startTime: e.startTime,
                        duration: e.duration,
                        thumbnailUrl: e.thumbnailUrl,
                    })),
                },
                videoChapters: {
                    create: chapters.map((c) => ({
                        title: c.title,
                        startTime: c.startTime,
                        endTime: c.endTime,
                        description: c.description,
                        thumbnailUrl: c.thumbnailUrl,
                        captions: {
                            create: (c.captions || []).map((cap) => ({
                                text: cap.text,
                                startTime: cap.startTime,
                                endTime: cap.endTime,
                            })),
                        },
                    })),
                },
            },
        });

        console.log(
            `✅ Seeded telemetry data for interview session ${interviewSession.id}`
        );

        // Print summary
        const companyCount = await prisma.company.count();
        const jobCount = await prisma.job.count();
        const userCount = await prisma.user.count();
        console.log(
            `📊 Summary: ${companyCount} companies, ${userCount} users, ${jobCount} jobs`
        );
    } catch (error) {
        console.error("❌ Error resetting database:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

resetDatabase();
