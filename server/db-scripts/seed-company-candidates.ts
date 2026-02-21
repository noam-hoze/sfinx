#!/usr/bin/env tsx

import { PrismaClient, UserRole, ApplicationStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { log } from "app/shared/services";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";
import { config } from "dotenv";
import path from "path";
import fs from "fs";

const LOG_CATEGORY = LOG_CATEGORIES.DB;

// Parse CLI flag: --env=dev or --env=prod
const envArg = process.argv.find(arg => arg.startsWith('--env='));
const environment = envArg?.split('=')[1] || 'dev'; // Default to dev

// Load the appropriate .env file based on environment
const rootDir = path.resolve(__dirname, '../..');
if (environment === 'dev') {
    config({ path: path.join(rootDir, '.env.local'), override: true });
    log.info(LOG_CATEGORY, "Loaded .env.local for dev environment");
} else {
    config({ path: path.join(rootDir, '.env'), override: true });
    log.info(LOG_CATEGORY, "Loaded .env for prod environment");
}

// Parse company IDs from CLI
const companiesArg = process.argv.find(arg => arg.startsWith('--companies='));
const companyIds = companiesArg
  ? companiesArg.split('=')[1].split(',').map(c => c.trim())
  : ['axonpulse', 'uvision']; // Default to both companies

const countArg = process.argv.find(arg => arg.startsWith('--count='));
const candidatesPerCompany = countArg ? parseInt(countArg.split('=')[1]) : 100;

if (!['dev', 'prod'].includes(environment)) {
    log.error(LOG_CATEGORY, "❌ Please specify --env=dev or --env=prod");
    process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    log.error(LOG_CATEGORY, '❌ DATABASE_URL is not set');
    process.exit(1);
}

log.info(LOG_CATEGORY, `Running on: ${environment.toUpperCase()}`);

const prisma = new PrismaClient();

// Diverse names (first names and last names)
const firstNames = [
    "Alex", "Jordan", "Morgan", "Casey", "Riley", "Taylor", "Avery", "Quinn",
    "Skyler", "Dakota", "River", "Phoenix", "Sage", "Bay", "Harper", "Finley",
    "Cameron", "Adrian", "Blake", "Drew", "Reese", "Rowan", "Sam", "Shea",
    "Kai", "Lee", "Cory", "Rory", "Ash", "Evan", "Jude", "Logan",
    "Emma", "Liam", "Olivia", "Noah", "Ava", "Ethan", "Sophia", "Mason",
    "Isabella", "Lucas", "Mia", "Benjamin", "Charlotte", "Elijah", "Amelia", "James",
    "Harper", "Benjamin", "Evelyn", "Lucas", "Abigail", "Henry", "Emily", "Alexander",
    "Scarlett", "Mason", "Aria", "Michael", "Gianna", "Ethan", "Avery", "Daniel",
    "Ella", "Jacob", "Chloe", "Logan", "Zoey", "Jackson", "Riley", "Aiden",
    "Nora", "Samuel", "Lily", "Benjamin", "Eleanor", "David", "Hannah", "Joseph",
    "Violet", "Thomas", "Grace", "Charles", "Alice", "Christopher", "Audrey", "Ryan",
    "Bella", "Gary", "Sophie", "Nicholas", "Mila", "Eric", "Lucy", "Jonathan",
];

const lastNames = [
    "Chen", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
    "Taylor", "Thomas", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
    "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Young",
    "Allen", "King", "Wright", "Scott", "Torres", "Peterson", "Phillips", "Campbell",
    "Parker", "Evans", "Edwards", "Collins", "Reeves", "Stewart", "Morris", "Morales",
    "Murphy", "Cook", "Rogers", "Morgan", "Peterson", "Cooper", "Reed", "Bell",
    "Gomez", "Murray", "Freeman", "Wells", "Webb", "Simpson", "Stevens", "Tucker",
    "Porter", "Hunter", "Hicks", "Crawford", "Henry", "Boyd", "Mason", "Moreno",
    "Kennedy", "Warren", "Dixon", "Ramos", "Reeves", "Burns", "Gordon", "Shaw",
    "Holmes", "Rice", "Robertson", "Hunt", "Black", "Daniels", "Palmer", "Mills",
];

// Gaussian random number generator using Box-Muller transform
function gaussianRandom(mean: number = 0, stdev: number = 1): number {
    const u = 1 - Math.random();
    const v = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z0 * stdev + mean;
}

// Generate Gaussian distributed scores (0-100)
function generateGaussianScore(): number {
    const score = gaussianRandom(65, 18); // Mean 65, StdDev 18
    return Math.max(0, Math.min(100, Math.round(score)));
}

// Get random element from array
function getRandomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

// Generate random categories for highlights from job categories
function generateCategories(baseScore: number, jobOpenRoles: any) {
    const experienceCategories: Record<string, { name: string; score: number }> = {};
    const codingCategories: Record<string, { name: string; score: number }> = {};

    // Get categories from job definition
    if (jobOpenRoles && jobOpenRoles.length > 0) {
        const role = jobOpenRoles[0];

        // Process experience categories
        if (role.experienceCategories && Array.isArray(role.experienceCategories)) {
            role.experienceCategories.forEach((cat: any) => {
                const key = cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
                experienceCategories[key] = {
                    name: cat.name,
                    score: Math.max(0, Math.min(100, baseScore + gaussianRandom(0, 15)))
                };
            });
        }

        // Process coding categories
        if (role.codingCategories && Array.isArray(role.codingCategories)) {
            role.codingCategories.forEach((cat: any) => {
                const key = cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
                codingCategories[key] = {
                    name: cat.name,
                    score: Math.max(0, Math.min(100, baseScore + gaussianRandom(0, 15)))
                };
            });
        }
    }

    return { experienceCategories, codingCategories };
}

// Generate random email
function generateEmail(name: string): string {
    const domains = ["gmail.com", "yahoo.com", "outlook.com", "linkedin.com", "tech.io"];
    const baseName = name.toLowerCase().replace(/\s+/g, ".");
    const domain = getRandomElement(domains);
    return `${baseName}${Math.floor(Math.random() * 10000)}@${domain}`;
}

// Generate Dicebear avatar URL (free service, no API key needed)
function generateAvatarUrl(seed: string): string {
    const styles = ["adventurer", "avataaars", "identicon"];
    const style = getRandomElement(styles);
    return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

async function deleteExistingCandidates(jobId: string, companyName: string) {
    log.info(LOG_CATEGORY, `Deleting existing ${companyName} candidates...`);
    const existingApplications = await prisma.application.findMany({
        where: { jobId },
        select: { candidateId: true },
    });

    if (existingApplications.length > 0) {
        const candidateIds = existingApplications.map(app => app.candidateId);
        await prisma.user.deleteMany({
            where: { id: { in: candidateIds } },
        });
        log.info(LOG_CATEGORY, `Deleted ${candidateIds.length} existing candidates`);
    }
}

async function seedCandidatesForCompany(companyId: string, count: number, hashedPassword: string) {
    log.info(LOG_CATEGORY, `\n=== Seeding ${count} candidates for ${companyId} ===`);

    // Load company data to get job categories
    const companiesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/companies.json'), 'utf-8'));
    const companyData = companiesData.find((c: any) => c.id === companyId);

    // Find company
    const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: { jobs: true },
    });

    if (!company) {
        log.error(LOG_CATEGORY, `❌ Company "${companyId}" not found. Skipping...`);
        return 0;
    }

    if (company.jobs.length === 0) {
        log.error(LOG_CATEGORY, `❌ No jobs found for ${company.name}. Skipping...`);
        return 0;
    }

    const job = company.jobs[0]; // Use first job
    log.info(LOG_CATEGORY, `Found job: ${job.title} (${job.id})`);

    // Delete existing candidates
    await deleteExistingCandidates(job.id, company.name);

    // Generate candidates
    const candidates = [];
    for (let i = 0; i < count; i++) {
        const firstName = getRandomElement(firstNames);
        const lastName = getRandomElement(lastNames);
        const name = `${firstName} ${lastName}`;
        const email = generateEmail(name);
        const score = generateGaussianScore();
        const avatarUrl = generateAvatarUrl(`${name}-${i}`);

        candidates.push({ name, email, score, avatarUrl });
    }

    // Log score distribution
    const scores = candidates.map(c => c.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    log.info(LOG_CATEGORY, `Generated ${count} candidates. Score distribution:`);
    log.info(LOG_CATEGORY, `  Min: ${minScore}, Max: ${maxScore}, Avg: ${Math.round(avgScore)}`);
    log.info(LOG_CATEGORY, `  Strong (75+): ${scores.filter(s => s >= 75).length}`);
    log.info(LOG_CATEGORY, `  Middle (40-74): ${scores.filter(s => s >= 40 && s < 75).length}`);
    log.info(LOG_CATEGORY, `  Weak (0-39): ${scores.filter(s => s < 40).length}`);

    // Create candidates in database
    log.info(LOG_CATEGORY, "Creating candidates in database...");
    let createdCount = 0;

    for (const candidateData of candidates) {
        try {
            const user = await prisma.user.create({
                data: {
                    id: `candidate-${companyId}-${createdCount}`,
                    name: candidateData.name,
                    email: candidateData.email,
                    password: hashedPassword,
                    role: UserRole.CANDIDATE,
                    image: candidateData.avatarUrl,
                },
            });

            await prisma.candidateProfile.create({
                data: {
                    userId: user.id,
                    jobTitle: job.title,
                    location: job.location,
                },
            });

            const application = await prisma.application.create({
                data: {
                    candidateId: user.id,
                    jobId: job.id,
                    status: ApplicationStatus.REVIEWED,
                    appliedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
                },
            });

            const interviewSession = await prisma.interviewSession.create({
                data: {
                    candidateId: user.id,
                    applicationId: application.id,
                    status: "COMPLETED",
                    completedAt: new Date(),
                    duration: Math.floor(30 * 60 + Math.random() * 30 * 60),
                    finalScore: candidateData.score,
                },
            });

            const { experienceCategories, codingCategories } = generateCategories(candidateData.score, companyData?.openRoles);

            await prisma.telemetryData.create({
                data: {
                    interviewSessionId: interviewSession.id,
                    matchScore: candidateData.score,
                    confidence: candidateData.score >= 75 ? "HIGH" : candidateData.score >= 50 ? "MEDIUM" : "LOW",
                    story: `Candidate scored ${candidateData.score} on the ${job.title} screening interview.`,
                    backgroundSummary: {
                        create: {
                            executiveSummary: `Strong candidate with ${candidateData.score >= 75 ? "excellent" : candidateData.score >= 50 ? "solid" : "developing"} background in ${job.title.toLowerCase()}.`,
                            experienceCategories: experienceCategories,
                            conversationJson: {},
                            evidenceJson: {},
                        },
                    },
                    codingSummary: {
                        create: {
                            executiveSummary: `Demonstrated ${candidateData.score >= 75 ? "exceptional" : candidateData.score >= 50 ? "competent" : "basic"} coding skills.`,
                            codeQualityScore: candidateData.score,
                            codeQualityText: candidateData.score >= 75 ? "Excellent" : candidateData.score >= 50 ? "Good" : "Needs Improvement",
                            jobSpecificCategories: codingCategories,
                        },
                    },
                },
            });

            createdCount++;
            if (createdCount % 10 === 0) {
                log.info(LOG_CATEGORY, `  Created ${createdCount} candidates...`);
            }
        } catch (error) {
            log.error(LOG_CATEGORY, `Error creating candidate ${candidateData.name}:`, error);
        }
    }

    log.info(LOG_CATEGORY, `✅ Created ${createdCount} candidates for ${company.name}`);
    return createdCount;
}

async function seedCompanyCandidates() {
    try {
        log.info(LOG_CATEGORY, `Starting candidate seeding for companies: ${companyIds.join(', ')}`);

        // Hash password once for all candidates
        const hashedPassword = await bcrypt.hash("sfinx", 12);

        let totalCreated = 0;
        for (const companyId of companyIds) {
            const created = await seedCandidatesForCompany(companyId, candidatesPerCompany, hashedPassword);
            totalCreated += created;
        }

        log.info(LOG_CATEGORY, `\n✅ Successfully seeded ${totalCreated} candidates across ${companyIds.length} companies!`);
        log.info(LOG_CATEGORY, "You can view them at /company-dashboard");
    } catch (error) {
        log.error(LOG_CATEGORY, "❌ Error seeding candidates:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

seedCompanyCandidates();
