#!/usr/bin/env tsx

import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function seedSarah() {
    try {
        console.log("👤 Creating Sarah candidate user...");

        // Hash the password
        const hashedPassword = await bcrypt.hash("sfinx", 12);

        // Check if Sarah already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: "sarah@gmail.com" },
        });

        if (existingUser) {
            console.log("✅ Sarah already exists. Skipping creation.");
            return;
        }

        const sarahCandidate = await prisma.user.create({
            data: {
                name: "Sarah",
                email: "sarah@gmail.com",
                password: hashedPassword,
                role: UserRole.CANDIDATE,
                image: "/uploads/profiles/sarah-profile.jpeg",
            },
        });

        // Create a basic candidate profile for Sarah
        await prisma.candidateProfile.create({
            data: {
                userId: sarahCandidate.id,
                jobTitle: "Frontend Developer",
                location: "Haifa, Israel",
                bio: "A skilled frontend developer.",
                skills: ["React", "Vue", "CSS"],
            },
        });

        console.log(`✅ Created candidate: ${sarahCandidate.email}`);
    } catch (error) {
        console.error("❌ Error creating Sarah candidate:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}
