#!/usr/bin/env tsx
/**
 * One-off script to populate the AxonPulse company's interviewGuideConfig.
 * Safe to re-run — idempotent upsert via company.update.
 * Run: tsx server/db-scripts/populate-axonpulse-guide.ts
 */

import { PrismaClient } from "@prisma/client";
import { log } from "app/shared/services";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";
import type { InterviewGuideConfig } from "app/shared/types/interviewGuide";
import { config as dotenv } from "dotenv";
import path from "path";

const LOG_CATEGORY = LOG_CATEGORIES.DB;

// Load env: --env=prod reads .env, otherwise .env.local (default for dev)
const envArg = process.argv.find((a) => a.startsWith("--env="));
const environment = envArg?.split("=")[1] ?? "dev";
const rootDir = path.resolve(__dirname, "../..");
dotenv({ path: path.join(rootDir, environment === "prod" ? ".env" : ".env.local"), override: true });

if (!process.env.DATABASE_URL) {
    log.error(LOG_CATEGORY, "❌ DATABASE_URL is not set.");
    process.exit(1);
}

const prisma = new PrismaClient();

const config: InterviewGuideConfig = {
    hero: {
        tagline: "Join the team turning AI complexity into clarity for critical defense and intelligence missions.",
        imageUrl: "https://axon-pulse.com/wp-content/uploads/2025/10/Thumbnail-1.jpg",
    },
    careersUrl: "https://axon-pulse.com/career/",
    culture: {
        missionText: "Our mission is to transform multi-sensor signals into faster, more reliable decisions for critical missions — and we build teams with the academic rigor and operational experience to make it happen.",
    },
    stages: [
        {
            title: "AI Screening",
            shortDescription: "A 30-min AI-powered voice interview — no scheduling needed.",
            duration: "~30 minutes",
            format: "Voice conversation (no video)",
            who: "Sfinx AI interviewer",
            interviewUrl: "/interview?companyId=axonpulse&jobId=axonpulse-deep-learning-engineer",
            description: "The first step is an automated screening interview conducted by our AI. You'll discuss your technical background in signal processing, computer vision, or deep learning, and work through a short algorithmic challenge. No camera required — just your voice and focus.",
            whatToExpect: [
                "Questions about your background in DL, CV, or signal processing",
                "A short algorithmic or mathematical reasoning challenge",
                "Behavioral questions using the S.T.A.R. format",
                "No video — a quiet environment and stable internet connection is all you need",
            ],
            howToPrepare: [
                "Review your work in signal processing, radar, or computer vision in detail",
                "Brush up on NumPy, FFT, and spectrogram concepts",
                "Prepare a quiet space — treat it like a real technical interview",
                "Use the S.T.A.R. framework when answering behavioral questions",
            ],
        },
        {
            title: "Technical Interview",
            shortDescription: "A 60-min video call with our CTO and a senior engineer.",
            duration: "60 minutes",
            format: "Video call",
            who: "Dr. Gil Goldman (CTO) + Senior Engineer",
            description: "If your screening goes well, you'll meet our CTO and a senior team member for a focused technical discussion. Expect a deep dive into your past projects, your mathematical intuition, and a live coding or system design problem related to our core domains.",
            whatToExpect: [
                "Deep-dive into 1–2 past technical projects with measurable impact",
                "Live coding or algorithm problem (Python, NumPy-level)",
                "System design questions around sensor pipelines or ML inference",
                "Questions on your approach to working in constrained, high-reliability environments",
            ],
            howToPrepare: [
                "Prepare 2–3 technical projects you can walk through end-to-end",
                "Review signal processing foundations: FFT, Mel filterbanks, convolution",
                "Practice live coding in Python without heavy framework reliance",
                "Think about how your work could apply to defense or intelligence contexts",
            ],
        },
        {
            title: "Deep-Dive & Take-Home Review",
            shortDescription: "A 90-min session reviewing your take-home or past code.",
            duration: "90 minutes",
            format: "Video call + code walkthrough",
            who: "R&D Team (Itzik Nanikashvili, Roee Partush)",
            description: "This stage goes deeper into your technical judgment and engineering discipline. You may be asked to present a take-home assignment or walk through a past codebase. The team will probe your design decisions, trade-offs, and how you handle ambiguity in fast-moving R&D environments.",
            whatToExpect: [
                "Code walkthrough of a take-home assignment or existing project",
                "Discussion of design trade-offs and alternative approaches",
                "Questions on performance optimization and deployment constraints",
                "A collaborative problem-solving session with the R&D team",
            ],
            howToPrepare: [
                "Complete any take-home assignment with production-quality care — document your reasoning",
                "Be ready to justify every design decision, including what you didn't do",
                "Review real-time processing constraints and model optimization techniques",
                "Think about how your solution would behave in an air-gapped or resource-limited system",
            ],
        },
        {
            title: "CEO Conversation",
            shortDescription: "A 30-min vision and culture conversation with Yaniv.",
            duration: "~30 minutes",
            format: "Video call",
            who: "Yaniv Vintrob, CEO",
            description: "The final stage is a candid conversation with our CEO, Yaniv Vintrob. This isn't a technical test — it's about mutual fit. Yaniv will share where AxonPulse is headed and what it takes to thrive here. Come with honest answers and real questions about the mission.",
            whatToExpect: [
                "An open conversation about AxonPulse's mission and roadmap",
                "Questions about your career motivations and long-term direction",
                "Discussion of what drives you in high-stakes, critical-mission work",
                "Space to ask anything about the company, team, or culture",
            ],
            howToPrepare: [
                "Read about AxonPulse's core technology: sensor fusion, multi-sensor systems",
                "Reflect on why defense and intelligence AI matters to you personally",
                "Prepare 3–4 genuine questions about the company's direction",
                "Be yourself — this conversation is as much about you evaluating us",
            ],
        },
    ],
    tips: [
        {
            title: "Master Signal Processing Foundations",
            description: "FFT, Mel filterbanks, convolution, and spectrograms are core to our work. Even if your role is CV-focused, fluency in signal fundamentals shows you can collaborate across our multi-sensor stack.",
            tags: ["Technical", "Signal Processing"],
        },
        {
            title: "Use the S.T.A.R. Framework",
            description: "For behavioral questions, structure your answers as Situation, Task, Action, Result. Concrete, specific examples from real work carry far more weight than general statements.",
            tags: ["Behavioral", "All stages"],
        },
        {
            title: "Research Our Technology",
            description: "We build AI that fuses radar, optical, and acoustic sensor data into unified intelligence. Understanding our perception, fusion, and command & control stack shows genuine interest and gives you better questions to ask.",
            tags: ["Preparation", "Culture"],
        },
        {
            title: "Code Without Heavy Frameworks",
            description: "Our technical challenges often use Python and NumPy directly — no PyTorch or TensorFlow shortcuts. This reveals your mathematical depth. Brush up on implementing algorithms from scratch.",
            tags: ["Technical", "Coding"],
        },
        {
            title: "Understand the Defense Context",
            description: "AxonPulse operates in sensitive, high-reliability environments — including air-gapped systems. Think about correctness, auditability, and operational safety. These constraints shape how we build everything.",
            tags: ["Domain", "Culture"],
        },
        {
            title: "Show Your Thinking, Not Just Your Answers",
            description: "We value methodical, rigorous problem-solvers. Think out loud, state your assumptions, ask clarifying questions, and walk us through trade-offs. A clear thought process matters as much as the solution.",
            tags: ["All stages", "Problem-solving"],
        },
    ],
    teamPhotos: [
        { name: "Yaniv Vintrob — CEO", imageUrl: "https://axon-pulse.com/wp-content/uploads/2025/10/Yaniv-1.png" },
        { name: "Dr. Gil Goldman — CTO", imageUrl: "https://axon-pulse.com/wp-content/uploads/2025/10/Gil-1.png" },
        { name: "Itzik Nanikashvili — Director of R&D", imageUrl: "https://axon-pulse.com/wp-content/uploads/2025/10/Itzik-1.png" },
        { name: "Roee Partush — Tech Lead", imageUrl: "https://axon-pulse.com/wp-content/uploads/2025/10/Roee-1.png" },
        { name: "Alon Rosenbaum — Director of Products", imageUrl: "https://axon-pulse.com/wp-content/uploads/2025/10/Alon-1.png" },
    ],
};

const COMPANY_DESCRIPTION = "AxonPulse builds advanced AI solutions for defense and intelligence missions — transforming multi-sensor signals into faster, more reliable decisions for critical operations. We combine deep expertise in signal processing, computer vision, and machine learning with real-world deployment experience in air-gapped and resource-constrained environments. As a partner, not a product company, we co-develop tailored solutions with the academic rigor and operational discipline that mission-critical work demands.";

const CULTURE_TAGS = ["Mission-driven", "Deep Technical Expertise", "Research Excellence", "Defense Domain Awareness", "Operational Rigor"];

/** Updates the AxonPulse company record with the interview guide config, description, and culture tags. */
async function run() {
    const updated = await prisma.company.update({
        where: { id: "axonpulse" },
        data: { interviewGuideConfig: config, description: COMPANY_DESCRIPTION, cultureTags: CULTURE_TAGS },
        select: { id: true, name: true },
    });
    log.info(LOG_CATEGORY, `✅ AxonPulse interview guide config saved for company: ${updated.name} (${updated.id})`);
}

run()
    .catch((err) => {
        log.error(LOG_CATEGORY, "❌ Failed to populate AxonPulse guide config", err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
