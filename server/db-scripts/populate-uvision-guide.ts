#!/usr/bin/env tsx
/**
 * One-off script to populate the Uvision company's interviewGuideConfig.
 * Safe to re-run — idempotent upsert via company.update.
 * Run: tsx server/db-scripts/populate-uvision-guide.ts
 */

import { PrismaClient } from "@prisma/client";
import { log } from "app/shared/services";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";
import type { InterviewGuideConfig } from "app/shared/types/interviewGuide";
import { config as dotenv } from "dotenv";
import path from "path";

const LOG_CATEGORY = LOG_CATEGORIES.DB;

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
        tagline: "Build real-time embedded software for mission-ready defense systems operating across air, land, and sea.",
        imageUrl: "/uploads/interview-guide/manager-uvision-1772954065395.png",
    },
    careersUrl: "https://uvisionuav.com/careers/",
    culture: {
        missionText: "Uvision develops smart integrated systems and loitering munition platforms for modern armed forces, combining autonomy, AI, multi-domain integration, and operational rigor to deliver mission-ready products at scale.",
    },
    stages: [
        {
            title: "AI Screening",
            shortDescription: "A 30-minute voice interview focused on RT embedded fundamentals and past projects.",
            duration: "~30 minutes",
            format: "Voice conversation",
            who: "Sfinx AI interviewer",
            description: "Your first step is an AI-led screening focused on your background in RT embedded software, C/C++, bare-metal development, and hardware-software integration. Expect questions about how you build reliable firmware, reason about constraints, and collaborate in multidisciplinary teams.",
            whatToExpect: [
                "Questions about past embedded or RT software projects",
                "Discussion of C/C++ depth, low-level debugging, and memory-aware design",
                "Behavioral prompts around ownership, self-management, and teamwork",
                "A practical conversation about integrating software with real hardware systems",
            ],
            howToPrepare: [
                "Be ready to explain one or two RT or embedded projects end-to-end",
                "Review ISR timing, concurrency, memory management, and low-level optimization",
                "Prepare concise examples of debugging hardware-software issues",
                "Answer behavioral questions with clear structure and specific outcomes",
            ],
        },
        {
            title: "Technical Interview",
            shortDescription: "A live technical deep dive with the embedded software team.",
            duration: "60 minutes",
            format: "Video call",
            who: "Embedded software lead and team member",
            description: "If you move forward, you'll meet engineers for a detailed discussion of real-time development, system design trade-offs, and embedded C++ practices. The focus is on how you think under constraints, structure software cleanly, and make sound engineering decisions in mission-critical environments.",
            whatToExpect: [
                "A deep dive into software architecture and design choices on embedded systems",
                "Questions about bare-metal development, scheduling, interrupts, and determinism",
                "Discussion of peripherals, protocols, and MCU or Jetson-based systems",
                "A closer look at documentation, ICD ownership, and review discipline",
            ],
            howToPrepare: [
                "Refresh embedded C/C++ fundamentals and system-level trade-offs",
                "Review SPI, I2C, UART, CAN, and common driver-development patterns",
                "Prepare to explain how you document interfaces and review software changes",
                "Think through examples where you balanced correctness, timing, and maintainability",
            ],
        },
        {
            title: "System Integration Review",
            shortDescription: "A hands-on conversation around integration, algorithms, and field readiness.",
            duration: "75-90 minutes",
            format: "Technical session",
            who: "Cross-functional engineering team",
            description: "This stage tests how you operate beyond isolated firmware tasks. Expect discussion around system-wide integration, algorithm implementation, performance analysis, field tests, and collaboration with system, mechanical, and integration teams.",
            whatToExpect: [
                "Scenario-based questions about integrating software with hardware across the system",
                "Discussion of field testing, performance analysis, and closing issues found in trials",
                "Questions on algorithm implementation in constrained environments",
                "Cross-functional problem solving involving system engineers and integration personnel",
            ],
            howToPrepare: [
                "Prepare examples where you brought up hardware or solved integration failures",
                "Review performance bottlenecks you have measured and improved on real targets",
                "Think through how you validate correctness before and during field tests",
                "Be ready to explain how you work across disciplines when requirements are still evolving",
            ],
        },
        {
            title: "Final Conversation",
            shortDescription: "A final discussion around fit, responsibility, and mission alignment.",
            duration: "~30 minutes",
            format: "Video call",
            who: "Hiring manager or leadership",
            description: "The last step is a mutual-fit discussion focused on how you work, communicate, and contribute in a defense technology environment. Uvision looks for engineers who can work independently, own technical decisions, and contribute thoughtfully in a mission-driven setting.",
            whatToExpect: [
                "A discussion about your motivation for defense and mission-critical engineering",
                "Questions about communication, ownership, and working in multidisciplinary teams",
                "Conversation around travel, field work, and adapting to dynamic project needs",
                "Time for you to ask about the team, products, and company direction",
            ],
            howToPrepare: [
                "Reflect on why this kind of mission and operating environment fits you",
                "Prepare examples of leading technical discussions and proposing solutions",
                "Bring thoughtful questions about the product, the team, and the development process",
                "Be direct about the environments in which you do your best work",
            ],
        },
    ],
    tips: [
        {
            title: "Show Real RT Experience",
            description: "Uvision's role is centered on real-time embedded software, so concrete examples matter. Be ready to explain interrupts, timing, deterministic behavior, and how you handled software on constrained targets.",
            tags: ["Technical", "RT"],
        },
        {
            title: "Lead With System Thinking",
            description: "The job goes beyond isolated coding tasks. Show how you think about software, hardware, integration, interfaces, and field behavior as one connected system.",
            tags: ["Systems", "Architecture"],
        },
        {
            title: "Know Your Embedded C++ Trade-offs",
            description: "Expect discussion around memory management, low-level optimization, multithreading, and maintainable code under hardware constraints. Practical trade-offs matter more than textbook answers.",
            tags: ["C++", "Embedded"],
        },
        {
            title: "Prepare Integration and Debug Stories",
            description: "Strong candidates can explain how they brought hardware up, diagnosed faults, and closed issues discovered during integration or trials. Specific debugging stories carry a lot of weight.",
            tags: ["Integration", "Debugging"],
        },
        {
            title: "Be Ready for Standards and Documentation",
            description: "The role mentions ICD work, software reviews, and regulated environments. Show that you can write clearly, document interfaces, and work with disciplined engineering processes.",
            tags: ["Documentation", "Process"],
        },
        {
            title: "Connect Your Work to the Mission",
            description: "Uvision builds defense systems for real operational use. It helps to understand the mission context and to speak clearly about reliability, readiness, and responsible engineering in that environment.",
            tags: ["Mission", "Culture"],
        },
    ],
    teamPhotos: [],
};

const COMPANY_DESCRIPTION = "Uvision is a global defense technology company focused on smart integrated systems and loitering munition platforms across air, land, and sea. The company develops autonomy, AI, and multi-domain capabilities in Israel and manufactures mission-ready systems for rapid deployment across international defense programs.";

const CULTURE_TAGS = ["Mission-driven", "Operational Rigor", "Systems Engineering", "Defense Technology", "Cross-Functional Collaboration"];

/** Updates the Uvision company record with the interview guide config, description, and culture tags. */
async function run() {
    const updated = await prisma.company.update({
        where: { id: "uvision" },
        data: { interviewGuideConfig: config, description: COMPANY_DESCRIPTION, cultureTags: CULTURE_TAGS },
        select: { id: true, name: true },
    });
    log.info(LOG_CATEGORY, `✅ Uvision interview guide config saved for company: ${updated.name} (${updated.id})`);
}

run()
    .catch((err) => {
        log.error(LOG_CATEGORY, "❌ Failed to populate Uvision guide config", err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
