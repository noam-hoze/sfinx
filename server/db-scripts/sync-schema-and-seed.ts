#!/usr/bin/env tsx

import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import { log } from "app/shared/services";
import fs from "fs";

async function syncSchemaAndSeed() {
    log.info("Starting database reset with new schema...");

    try {
        // Parse CLI flag: --env=dev or --env=prod
        const envArg = process.argv.find(arg => arg.startsWith('--env='));
        const environment = envArg?.split('=')[1];
        
        if (!environment || !['dev', 'prod'].includes(environment)) {
            throw new Error("Please specify --env=dev or --env=prod");
        }
        
        const databaseUrl = environment === 'dev' 
            ? process.env.DEV_DATABASE_URL 
            : process.env.PROD_DATABASE_URL;
        
        if (!databaseUrl) {
            throw new Error(`${environment === 'dev' ? 'DEV_DATABASE_URL' : 'PROD_DATABASE_URL'} is not set in environment variables`);
        }
        
        log.info(`Running on: ${environment.toUpperCase()}`);
        log.info(`Database: ${databaseUrl.split('@')[1]?.split('/')[0]}`);
        
        // Set DATABASE_URL in process.env for PrismaClient
        process.env.DATABASE_URL = databaseUrl;
        
        const execOptions = {
            stdio: "inherit" as const,
            env: { 
                ...process.env,
                DATABASE_URL: databaseUrl,
            },
        };

        // 1. Generate Prisma client with the latest schema
        log.info("⚡ Generating Prisma client...");
        execSync("pnpm prisma generate --schema server/prisma/schema.prisma", execOptions);

        // 2. Push the new schema to the database (apply DDL)
        log.info("🚀 Pushing new schema to database...");
        execSync("pnpm prisma db push --schema server/prisma/schema.prisma --accept-data-loss", execOptions);

        // 3. Reset and seed data against the new schema
        log.info(
            "📦 Resetting and seeding database (fresh data on new schema)..."
        );
        execSync("pnpm seed", execOptions);

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
        execSync("pnpm prisma studio --schema server/prisma/schema.prisma", execOptions);
    } catch (error) {
        log.error("❌ Error during database reset:", error);
        process.exit(1);
    }
}

syncSchemaAndSeed();
