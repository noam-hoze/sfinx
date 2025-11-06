import type { PrismaClient as PrismaClientType } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClientType | undefined;
};

/**
 * Creates a no-op Prisma client surrogate for offline or mocked environments.
 */
const createMockPrisma = (): PrismaClientType => {
    const noopAsync = async () => undefined;

    return new Proxy(
        {},
        {
            get: (_target, property) => {
                if (property === "$connect" || property === "$disconnect") {
                    return noopAsync;
                }

                return new Proxy(noopAsync, {
                    apply: noopAsync,
                });
            },
        },
    ) as PrismaClientType;
};

let prismaClient: PrismaClientType;

if ((process.env.MOCK_PRISMA_CLIENT ?? "").toLowerCase() === "true") {
    prismaClient = createMockPrisma();
} else {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
    const { PrismaClient } = require("@prisma/client") as {
        PrismaClient: new () => PrismaClientType;
    };

    prismaClient = globalForPrisma.prisma ?? new PrismaClient();

    if (process.env.NODE_ENV !== "production") {
        globalForPrisma.prisma = prismaClient;
    }
}

export const prisma = prismaClient;
