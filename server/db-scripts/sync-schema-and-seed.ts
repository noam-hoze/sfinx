#!/usr/bin/env tsx

import { config } from "dotenv";
import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import { log } from "app/shared/services";

// Load environment variables from .env file
config();

async function syncSchemaAndSeed() {
    log.info("Starting database reset with new schema...");

    try {
        // 1. Generate Prisma client with the latest schema
        log.info("⚡ Generating Prisma client...");
        execSync("pnpm prisma generate --schema server/prisma/schema.prisma", {
            stdio: "inherit",
        });

        // 2. Push the new schema to the database (apply DDL)
        log.info("🚀 Pushing new schema to database...");
        execSync("pnpm prisma db push --schema server/prisma/schema.prisma", {
            stdio: "inherit",
        });

        // 3. Reset and seed data against the new schema
        log.info(
            "📦 Resetting and seeding database (fresh data on new schema)..."
        );
        execSync("pnpm seed", { stdio: "inherit" });

        // 4. Verify the schema was applied correctly
        log.info("Verifying schema...");
        const prisma = new PrismaClient();

        // Test that we can query the new relationship
        const testQuery = await prisma.application.findMany({
            include: {
                interviewSessions: true,
            },
            take: 1,
        });

        log.info("Schema verification successful!");
        log.info("Database reset and new schema applied successfully!");
        log.info("");
        log.info("New relationship confirmed:");
        log.info("   - Application.interviewSessions: InterviewSession[]");
        log.info(
            "   - One application can now have many interview sessions"
        );

        await prisma.$disconnect();

        // 5. Open Prisma Studio for quick inspection
        log.info("Opening Prisma Studio...");
        execSync("pnpm prisma studio --schema server/prisma/schema.prisma", {
            stdio: "inherit",
        });
    } catch (error) {
        log.error("❌ Error during database reset:", error);
        process.exit(1);
    }
}

syncSchemaAndSeed();
