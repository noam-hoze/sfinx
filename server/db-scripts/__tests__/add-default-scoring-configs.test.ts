/**
 * Unit tests for add-default-scoring-configs helpers.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { assertMutationAllowed, parseFlags, resolveDatabaseUrl } from "../add-default-scoring-configs";
import { log } from "app/shared/services/logger";

vi.mock("@prisma/client", () => ({
    PrismaClient: class {},
}));

vi.mock("app/shared/services/logger", () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/**
 * Reset database environment variables.
 */
function resetEnv() {
    delete process.env.DEV_DATABASE_URL;
    delete process.env.DATABASE_URL;
}

beforeEach(() => {
    vi.resetAllMocks();
    resetEnv();
});

describe("resolveDatabaseUrl", () => {
    it("throws when no database URL is set", () => {
        expect(() => resolveDatabaseUrl()).toThrow("DATABASE_URL is required.");
        expect(log.error).toHaveBeenCalled();
    });

    it("returns DEV_DATABASE_URL when set", () => {
        process.env.DEV_DATABASE_URL = "dev-url";
        expect(resolveDatabaseUrl()).toBe("dev-url");
    });
});

describe("parseFlags", () => {
    it("parses apply and dry-run flags", () => {
        const flags = parseFlags(["node", "script", "--apply", "--dry-run"]);
        expect(flags).toEqual({ apply: true, dryRun: true });
    });
});

describe("assertMutationAllowed", () => {
    it("throws without apply flag", () => {
        expect(() => assertMutationAllowed({ apply: false, dryRun: false })).toThrow("Missing --apply flag.");
    });
});
