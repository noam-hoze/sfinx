#!/usr/bin/env tsx

import { PrismaClient, UserRole, ApplicationStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { log } from "app/shared/services";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.DB;

// Parse CLI flag: --env=dev or --env=prod
const envArg = process.argv.find(arg => arg.startsWith('--env='));
const environment = envArg?.split('=')[1] || 'dev'; // Default to dev

if (!['dev', 'prod'].includes(environment)) {
    log.error(LOG_CATEGORY, "❌ Please specify --env=dev or --env=prod");
    process.exit(1);
}

const databaseUrl = environment === 'dev' 
    ? process.env.DEV_DATABASE_URL 
    : process.env.PROD_DATABASE_URL;

if (!databaseUrl) {
    log.error(LOG_CATEGORY, `❌ ${environment === 'dev' ? 'DEV_DATABASE_URL' : 'PROD_DATABASE_URL'} is not set`);
    process.exit(1);
}

log.info(LOG_CATEGORY, `Running on: ${environment.toUpperCase()}`);
process.env.DATABASE_URL = databaseUrl;

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

// Generate random categories for highlights
function generateCategories(baseScore: number) {
    const experienceCategories = {
        neural_networks: { name: "Neural Networks", score: Math.max(0, Math.min(100, baseScore + gaussianRandom(0, 15))) },
        deep_learning: { name: "Deep Learning", score: Math.max(0, Math.min(100, baseScore + gaussianRandom(0, 15))) },
        computer_vision: { name: "Computer Vision", score: Math.max(0, Math.min(100, baseScore + gaussianRandom(0, 15))) },
        nlp: { name: "Natural Language Processing", score: Math.max(0, Math.min(100, baseScore + gaussianRandom(0, 15))) },
    };

    const codingCategories = {
        pytorch: { name: "PyTorch", score: Math.max(0, Math.min(100, baseScore + gaussianRandom(0, 15))) },
        tensorflow: { name: "TensorFlow", score: Math.max(0, Math.min(100, baseScore + gaussianRandom(0, 15))) },
        python: { name: "Python", score: Math.max(0, Math.min(100, baseScore + gaussianRandom(0, 15))) },
        model_optimization: { name: "Model Optimization", score: Math.max(0, Math.min(100, baseScore + gaussianRandom(0, 15))) },
    };

    return { experienceCategories, codingCategories };
}

// Generate contextual profile summary based on score
function generateProfileSummary(score: number, categories: { experienceCategories: any; codingCategories: any }): { story: string; backgroundSummaryText: string; codingSummaryText: string } {
    let tier: string;
    let performance: string;
    let confidence: string;
    let backgroundText: string;
    let codingText: string;
    let storyText: string;

    if (score >= 95) {
        tier = "Elite";
        performance = "exceptional performance across all dimensions";
        confidence = "outstanding";
        backgroundText = "Elite performer with exceptional depth in ML theory and cutting-edge deep learning techniques. Demonstrates mastery of neural architectures and advanced optimization strategies.";
        codingText = "Exceptional code quality with expert-level proficiency in PyTorch and TensorFlow. Writes production-ready, optimized implementations with sophisticated error handling and architectural patterns.";
        storyText = `<span style="color: rgba(52, 199, 89, 0.9)">Elite performer</span> with <span style="color: rgba(52, 199, 89, 0.9)">exceptional expertise</span> in deep learning. Demonstrates mastery of neural architectures and delivers production-grade code.`;
    } else if (score >= 85) {
        tier = "Advanced";
        performance = "strong performance with expert-level skills";
        confidence = "high";
        backgroundText = "Advanced practitioner with strong theoretical foundation in deep learning. Demonstrates strong understanding of neural networks and model optimization techniques. Well-versed in research-grade implementations.";
        codingText = "Strong coding skills with proficient use of PyTorch and TensorFlow. Implements clean, well-structured code with good optimization practices. Shows understanding of performance considerations.";
        storyText = `<span style="color: rgba(52, 199, 89, 0.9)">Advanced practitioner</span> in deep learning with <span style="color: rgba(52, 199, 89, 0.9)">strong technical foundation</span>. Demonstrates solid coding practices and good understanding of ML concepts.`;
    } else if (score >= 75) {
        tier = "Proficient";
        performance = "solid performance with good technical competency";
        confidence = "high";
        backgroundText = "Proficient ML engineer with solid understanding of deep learning fundamentals. Competent in neural networks, and has practical experience with model optimization and deployment considerations.";
        codingText = "Good coding skills with competent usage of PyTorch and TensorFlow. Writes functional code that works correctly. Shows understanding of common ML patterns and best practices.";
        storyText = `<span style="color: rgba(52, 199, 89, 0.9)">Proficient engineer</span> with solid deep learning knowledge. Good coding abilities and practical understanding of ML workflows.`;
    } else if (score >= 60) {
        tier = "Competent";
        performance = "competent performance with developing advanced skills";
        confidence = "medium";
        backgroundText = "Competent engineer with foundational understanding of deep learning. Demonstrates knowledge of basic neural network concepts and some experience with optimization techniques. Room for growth in advanced topics.";
        codingText = "Competent coding skills with functional implementations in PyTorch and TensorFlow. Code is generally correct but may lack optimization or advanced patterns. Shows understanding of core ML concepts.";
        storyText = `<span style="color: rgba(52, 199, 89, 0.9)">Competent engineer</span> with foundational ML knowledge. Able to implement working solutions with <span style="color: rgba(255, 59, 48, 0.9)">room for growth</span> in advanced areas.`;
    } else if (score >= 50) {
        tier = "Developing";
        performance = "developing performance with solid foundational understanding";
        confidence = "medium";
        backgroundText = "Developing ML engineer with basic understanding of deep learning concepts. Familiar with neural networks at an introductory level. Needs further development in advanced topics and practical applications.";
        codingText = "Developing coding skills with basic implementations of ML models. Code is functional but may have inefficiencies or lack polish. Shows understanding of fundamentals with growth potential.";
        storyText = `Developing ML engineer with <span style="color: rgba(52, 199, 89, 0.9)">basic foundational knowledge</span>. Shows potential but needs <span style="color: rgba(255, 59, 48, 0.9)">further development</span> in advanced areas.`;
    } else if (score >= 40) {
        tier = "Emerging";
        performance = "emerging skills with foundational concepts in progress";
        confidence = "low";
        backgroundText = "Emerging engineer with basic familiarity with deep learning concepts. Limited practical experience with neural networks. Would benefit from mentorship and focused development in core ML areas.";
        codingText = "Basic coding skills with simple ML implementations. Code works but lacks optimization and may have structural issues. Needs development in best practices and advanced patterns.";
        storyText = `<span style="color: rgba(255, 59, 48, 0.9)">Emerging engineer</span> with basic ML knowledge. Shows potential but requires <span style="color: rgba(255, 59, 48, 0.9)">significant development</span> in technical depth.`;
    } else {
        tier = "Entry-Level";
        performance = "entry-level performance with limited practical experience";
        confidence = "low";
        backgroundText = "Entry-level candidate with limited background in deep learning. Needs substantial development in ML fundamentals, neural networks, and practical implementation skills.";
        codingText = "Entry-level coding skills. ML implementations are basic and may have correctness issues. Needs development in problem-solving, code quality, and ML-specific practices.";
        storyText = `Entry-level candidate with <span style="color: rgba(255, 59, 48, 0.9)">limited ML experience</span>. Requires <span style="color: rgba(255, 59, 48, 0.9)">comprehensive training</span> in deep learning fundamentals.`;
    }

    return {
        story: storyText,
        backgroundSummaryText: backgroundText,
        codingSummaryText: codingText,
    };
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

async function seedAxonPulseCandidates() {
    try {
        log.info(LOG_CATEGORY, "Starting AxonPulse candidate seeding...");

        // Find AxonPulse company and Deep Learning Engineer job
        const axonPulseCompany = await prisma.company.findUnique({
            where: { name: "AxonPulse" },
        });

        if (!axonPulseCompany) {
            throw new Error("AxonPulse company not found. Please run seed-data.ts first.");
        }

        const deepLearningJob = await prisma.job.findFirst({
            where: {
                companyId: axonPulseCompany.id,
                title: "Deep Learning Engineer",
            },
        });

        if (!deepLearningJob) {
            throw new Error("Deep Learning Engineer job not found for AxonPulse.");
        }

        log.info(LOG_CATEGORY, `Found AxonPulse job: ${deepLearningJob.id}`);

        // Delete existing AxonPulse candidates
        log.info(LOG_CATEGORY, "Deleting existing AxonPulse candidates...");
        const existingApplications = await prisma.application.findMany({
            where: { jobId: deepLearningJob.id },
            select: { candidateId: true },
        });
        
        if (existingApplications.length > 0) {
            const candidateIds = existingApplications.map(app => app.candidateId);
            await prisma.user.deleteMany({
                where: { id: { in: candidateIds } },
            });
            log.info(LOG_CATEGORY, `Deleted ${candidateIds.length} existing candidates`);
        }

        // Hash password once
        const hashedPassword = await bcrypt.hash("sfinx", 12);

        // Generate candidates
        const candidates = [];
        for (let i = 0; i < 100; i++) {
            const firstName = getRandomElement(firstNames);
            const lastName = getRandomElement(lastNames);
            const name = `${firstName} ${lastName}`;
            const email = generateEmail(name);
            const score = generateGaussianScore();
            const avatarUrl = generateAvatarUrl(`${name}-${i}`);

            candidates.push({
                name,
                email,
                score,
                avatarUrl,
            });
        }

        log.info(LOG_CATEGORY, `Generated 100 candidates. Score distribution:`);
        const scores = candidates.map((c) => c.score);
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        const minScore = Math.min(...scores);
        const maxScore = Math.max(...scores);
        log.info(LOG_CATEGORY, `  Min: ${minScore}, Max: ${maxScore}, Avg: ${Math.round(avgScore)}`);
        log.info(LOG_CATEGORY, `  Strong (75+): ${scores.filter((s) => s >= 75).length}`);
        log.info(LOG_CATEGORY, `  Middle (40-74): ${scores.filter((s) => s >= 40 && s < 75).length}`);
        log.info(LOG_CATEGORY, `  Weak (0-39): ${scores.filter((s) => s < 40).length}`);

        log.info(LOG_CATEGORY, "Creating candidates in database...");

        let createdCount = 0;
        for (const candidateData of candidates) {
            try {
                // Create candidate user
                const user = await prisma.user.create({
                    data: {
                        id: `candidate-axonpulse-${createdCount}`,
                        name: candidateData.name,
                        email: candidateData.email,
                        password: hashedPassword,
                        role: UserRole.CANDIDATE,
                        image: candidateData.avatarUrl,
                    },
                });

                // Create candidate profile
                await prisma.candidateProfile.create({
                    data: {
                        userId: user.id,
                        jobTitle: "Deep Learning Engineer",
                        location: "Remote",
                    },
                });

                // Create application
                const application = await prisma.application.create({
                    data: {
                        candidateId: user.id,
                        jobId: deepLearningJob.id,
                        status: ApplicationStatus.REVIEWED,
                        appliedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within last 30 days
                    },
                });

                // Create interview session with score
                const interviewSession = await prisma.interviewSession.create({
                    data: {
                        candidateId: user.id,
                        applicationId: application.id,
                        status: "COMPLETED",
                        completedAt: new Date(),
                        duration: Math.floor(30 * 60 + Math.random() * 30 * 60), // 30-60 minutes
                        finalScore: candidateData.score,
                    },
                });

                // Generate categories for highlights
                const { experienceCategories, codingCategories } = generateCategories(candidateData.score);

                // Generate contextual profile summary based on score
                const { story, backgroundSummaryText, codingSummaryText } = generateProfileSummary(candidateData.score, { experienceCategories, codingCategories });

                // Create telemetry data with score and summaries
                await prisma.telemetryData.create({
                    data: {
                        interviewSessionId: interviewSession.id,
                        matchScore: candidateData.score,
                        confidence: candidateData.score >= 75 ? "HIGH" : candidateData.score >= 50 ? "MEDIUM" : "LOW",
                        story: story,
                        backgroundSummary: {
                            create: {
                                executiveSummary: backgroundSummaryText,
                                experienceCategories: experienceCategories,
                                conversationJson: {},
                                evidenceJson: {},
                            },
                        },
                        codingSummary: {
                            create: {
                                executiveSummary: codingSummaryText,
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

        log.info(LOG_CATEGORY, `✅ Successfully created ${createdCount} AxonPulse candidates!`);
        log.info(
            LOG_CATEGORY,
            "You can now view them in the company dashboard at /company-dashboard"
        );
    } catch (error) {
        log.error(LOG_CATEGORY, "❌ Error seeding candidates:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

seedAxonPulseCandidates();
