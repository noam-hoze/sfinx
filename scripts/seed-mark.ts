#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";
import { seedBasicCandidate } from "./seed-utils";

const prisma = new PrismaClient();

export async function seedMark() {
    try {
        console.log("👤 Creating Mark candidate user...");

        await seedBasicCandidate(prisma, {
            name: "Mark",
            email: "mark@gmail.com",
            image: "/uploads/profiles/mark-profile.jpeg",
            jobTitle: "Frontend Developer",
            location: "Haifa, Israel",
            bio: "A skilled frontend developer.",
            skills: ["React", "Vue", "CSS"],
        });
    } catch (error) {
        console.error("❌ Error creating Mark candidate:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}
