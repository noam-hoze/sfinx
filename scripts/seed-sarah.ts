#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";
import { seedBasicCandidate } from "./seed-utils";

const prisma = new PrismaClient();

export async function seedSarah() {
    try {
        console.log("👤 Creating Sarah candidate user...");

        await seedBasicCandidate(prisma, {
            name: "Sarah",
            email: "sarah@gmail.com",
            image: "/uploads/profiles/sarah-profile.jpeg",
            jobTitle: "Frontend Developer",
            location: "Haifa, Israel",
            bio: "A skilled frontend developer.",
            skills: ["React", "Vue", "CSS"],
        });
    } catch (error) {
        console.error("❌ Error creating Sarah candidate:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}
