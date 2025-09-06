#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkDatabase() {
    try {
        console.log("🔍 Checking database contents...\n");

        // Check Company table
        const companyCount = await prisma.company.count();
        console.log(`📊 Company table: ${companyCount} records`);

        if (companyCount > 0) {
            const companies = await prisma.company.findMany({
                take: 5,
                select: { name: true, id: true },
            });
            console.log(
                "   Sample companies:",
                companies.map((c) => c.name)
            );
        }

        // Check CompanyProfile table
        const companyProfileCount = await prisma.companyProfile.count();
        console.log(`📊 CompanyProfile table: ${companyProfileCount} records`);

        if (companyProfileCount > 0) {
            const profiles = await prisma.companyProfile.findMany({
                take: 5,
                select: { companyName: true, userId: true },
            });
            console.log(
                "   Sample profiles:",
                profiles.map((p) => p.companyName)
            );
        }

        // Check Job table
        const jobCount = await prisma.job.count();
        console.log(`📊 Job table: ${jobCount} records`);

        // Check User table
        const userCount = await prisma.user.count();
        console.log(`📊 User table: ${userCount} records`);

        if (userCount > 0) {
            const users = await prisma.user.findMany({
                take: 5,
                select: { id: true, email: true, name: true, image: true },
            });
            console.log("   Sample users:");
            users.forEach((user) => {
                console.log(
                    `     - ${user.email}: image=${user.image || "null"}`
                );
            });
        }
    } catch (error) {
        console.error("❌ Error checking database:", error);
    } finally {
        await prisma.$disconnect();
    }
}

checkDatabase();
