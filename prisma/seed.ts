import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    // Create 2 JDs, each with 3 tasks
    const jdData = [
        {
            title: "Frontend Engineer",
            summary: "Build UI components and client-side features.",
            tags: ["frontend", "react", "typescript"],
            tasks: [
                {
                    title: "Button Component",
                    prompt: "Implement a reusable Button.",
                    hiddenTestsJson: { tests: ["renders", "clicks"] },
                },
                {
                    title: "Debounce Function",
                    prompt: "Implement debounce utility.",
                    hiddenTestsJson: { tests: ["debounces", "flush"] },
                },
                {
                    title: "Fetch Wrapper",
                    prompt: "Wrap fetch with timeout.",
                    hiddenTestsJson: { tests: ["timeout", "json"] },
                },
            ],
        },
        {
            title: "Backend Engineer",
            summary: "Build APIs and services.",
            tags: ["backend", "node", "api"],
            tasks: [
                {
                    title: "Rate Limiter",
                    prompt: "Implement token bucket.",
                    hiddenTestsJson: { tests: ["allow", "block"] },
                },
                {
                    title: "Queue Processor",
                    prompt: "Process jobs with retries.",
                    hiddenTestsJson: { tests: ["retry", "backoff"] },
                },
                {
                    title: "Validation Layer",
                    prompt: "Validate payloads.",
                    hiddenTestsJson: { tests: ["schema", "errors"] },
                },
            ],
        },
    ];

    for (const jd of jdData) {
        const createdJd = await prisma.jD.create({
            data: {
                title: jd.title,
                summary: jd.summary,
                tags: jd.tags,
            },
        });
        for (const task of jd.tasks) {
            await prisma.task.create({
                data: {
                    jdId: createdJd.id,
                    title: task.title,
                    prompt: task.prompt,
                    hiddenTestsJson: task.hiddenTestsJson as any,
                },
            });
        }
    }
}

main()
    .then(async () => {
        await prisma.$disconnect();
        // eslint-disable-next-line no-console
        console.log("Seed completed");
    })
    .catch(async (e) => {
        // eslint-disable-next-line no-console
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
