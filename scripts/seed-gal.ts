#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";
import { seedBasicCandidate } from "./seed-utils";

const prisma = new PrismaClient();

export async function seedGal() {
    try {
        console.log("👤 Creating Gal candidate user...");

        await seedBasicCandidate(prisma, {
            name: "Gal",
            email: "gal@gmail.com",
            image: "/uploads/profiles/gal-profile.jpeg",
            jobTitle: "Software Engineer",
            location: "Tel Aviv, Israel",
            bio: "A talented software engineer.",
            skills: ["React", "TypeScript", "Node.js"],
        });
    } catch (error) {
        console.error("❌ Error creating Gal candidate:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}
