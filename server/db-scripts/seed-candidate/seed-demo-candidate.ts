#!/usr/bin/env tsx

/**
 * Seeds the demo candidate user for the demo flow.
 * This user is used when users try the demo without authentication.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { log } from "app/shared/services";

const prisma = new PrismaClient();

/**
 * Creates or updates the demo candidate user.
 */
export async function seedDemoCandidate() {
    try {
        const hashedPassword = await bcrypt.hash("demo123", 12);

        const demoUser = await prisma.user.upsert({
            where: { email: "demo-candidate@sfinx.demo" },
            update: {
                name: "Demo Candidate",
                password: hashedPassword,
                role: "CANDIDATE",
                image: undefined,
            },
            create: {
                id: "demo-candidate-user-id",
                name: "Demo Candidate",
                email: "demo-candidate@sfinx.demo",
                password: hashedPassword,
                role: "CANDIDATE",
            },
        });

        await prisma.candidateProfile.upsert({
            where: { userId: demoUser.id },
            update: {
                jobTitle: "Software Engineer",
                location: "Remote",
                bio: "Demo candidate for Sfinx interview platform",
                skills: ["React", "TypeScript", "Node.js"],
            },
            create: {
                userId: demoUser.id,
                jobTitle: "Software Engineer",
                location: "Remote",
                bio: "Demo candidate for Sfinx interview platform",
                skills: ["React", "TypeScript", "Node.js"],
            },
        });

        log.info(`✅ Demo candidate seeded: ${demoUser.email}`);
        return demoUser;
    } catch (error) {
        log.error("❌ Error seeding demo candidate:", error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    seedDemoCandidate()
        .then(() => {
            log.info("Demo candidate seed complete");
            process.exit(0);
        })
        .catch((error) => {
            log.error("Failed to seed demo candidate:", error);
            process.exit(1);
        });
}

