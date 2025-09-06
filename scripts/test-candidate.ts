#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function testCandidate() {
    try {
        const user = await prisma.user.findUnique({
            where: { email: "noam.hoze@gmail.com" },
            include: { candidateProfile: true },
        });

        if (user) {
            console.log("✅ Candidate user found:");
            console.log("Name:", user.name);
            console.log("Email:", user.email);
            console.log("Role:", user.role);
            console.log("Has profile:", !!user.candidateProfile);

            if (user.candidateProfile) {
                console.log("Job Title:", user.candidateProfile.jobTitle);
                console.log("Location:", user.candidateProfile.location);
                console.log("Skills:", user.candidateProfile.skills);
            }

            // Test password verification
            const isValid = await bcrypt.compare("sfinx", user.password);
            console.log("Password 'sfinx' valid:", isValid);
        } else {
            console.log("❌ User not found");
        }
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await prisma.$disconnect();
    }
}

testCandidate();
