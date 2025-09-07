#!/usr/bin/env tsx

import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seedGal() {
    try {
        console.log("👤 Creating Gal candidate user...");

        // Hash the password
        const hashedPassword = await bcrypt.hash("sfinx", 12);

        // Check if Gal already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: "gal@gmail.com" },
        });

        if (existingUser) {
            console.log("✅ Gal already exists. Skipping creation.");
            return;
        }

        const galCandidate = await prisma.user.create({
            data: {
                name: "Gal",
                email: "gal@gmail.com",
                password: hashedPassword,
                role: UserRole.CANDIDATE,
                image: "/uploads/profiles/gal-profile.jpeg",
            },
        });

        // Create a basic candidate profile for Gal
        await prisma.candidateProfile.create({
            data: {
                userId: galCandidate.id,
                jobTitle: "Software Engineer",
                location: "Tel Aviv, Israel",
                bio: "A talented software engineer.",
                skills: ["React", "TypeScript", "Node.js"],
            },
        });

        console.log(`✅ Created candidate: ${galCandidate.email}`);
    } catch (error) {
        console.error("❌ Error creating Gal candidate:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

seedGal();
