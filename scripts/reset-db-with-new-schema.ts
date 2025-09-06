#!/usr/bin/env tsx

import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";

async function resetDatabaseWithNewSchema() {
    console.log("🔄 Starting database reset with new schema...");

    try {
        // 1. Reset the database (drops all tables and data)
        console.log("📦 Resetting database...");
        execSync("pnpm reset-db", { stdio: "inherit" });

        // 2. Generate Prisma client with new schema
        console.log("⚡ Generating Prisma client...");
        execSync("pnpm prisma generate", { stdio: "inherit" });

        // 3. Push the new schema to database
        console.log("🚀 Pushing new schema to database...");
        execSync("pnpm prisma db push", { stdio: "inherit" });

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
    } catch (error) {
        console.error("❌ Error during database reset:", error);
        process.exit(1);
    }
}

resetDatabaseWithNewSchema();
