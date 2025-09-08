#!/usr/bin/env tsx

import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";

async function syncSchemaAndReseed() {
    console.log("🔄 Starting database reset with new schema...");

    try {
        // 1. Generate Prisma client with the latest schema
        console.log("⚡ Generating Prisma client...");
        execSync("pnpm prisma generate", { stdio: "inherit" });

        // 2. Push the new schema to the database (apply DDL)
        console.log("🚀 Pushing new schema to database...");
        execSync("pnpm prisma db push", { stdio: "inherit" });

        // 3. Reset and seed data against the new schema
        console.log(
            "📦 Resetting and seeding database (fresh data on new schema)..."
        );
        execSync("pnpm reset-db", { stdio: "inherit" });

        // 4. Verify the schema was applied correctly
        console.log("✅ Verifying schema...");
        const prisma = new PrismaClient();

        // Test that we can query the new relationship
        const testQuery = await prisma.application.findMany({
            include: {
                interviewSessions: true,
            },
            take: 1,
        });

        console.log("✅ Schema verification successful!");
        console.log("✅ Database reset and new schema applied successfully!");
        console.log("");
        console.log("📋 New relationship confirmed:");
        console.log("   - Application.interviewSessions: InterviewSession[]");
        console.log(
            "   - One application can now have many interview sessions"
        );

        await prisma.$disconnect();

        // 5. Open Prisma Studio for quick inspection
        console.log("🪟 Opening Prisma Studio...");
        execSync("pnpm prisma studio", { stdio: "inherit" });
    } catch (error) {
        console.error("❌ Error during database reset:", error);
        process.exit(1);
    }
}

syncSchemaAndReseed();
