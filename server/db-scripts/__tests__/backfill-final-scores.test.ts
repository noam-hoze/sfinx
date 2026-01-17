/**
 * Unit tests for backfill-final-scores helpers.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { assertMutationAllowed, parseFlags, requireNumber, requireValue, resolveDatabaseUrl } from "../backfill-final-scores";
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
});

describe("requireNumber", () => {
    it("throws when value is not a number", () => {
        expect(() => requireNumber("bad", "score")).toThrow("score must be a finite number.");
        expect(log.error).toHaveBeenCalled();
    });
});

describe("requireValue", () => {
    it("throws when value is undefined", () => {
        expect(() => requireValue(undefined, "missing")).toThrow("missing is required.");
        expect(log.error).toHaveBeenCalled();
    });
});

describe("parseFlags", () => {
    it("parses apply and dry-run flags", () => {
        const flags = parseFlags(["node", "script", "--apply", "--preview"]);
        expect(flags).toEqual({ apply: true, dryRun: true });
    });
});

describe("assertMutationAllowed", () => {
    it("throws without apply flag", () => {
        expect(() => assertMutationAllowed({ apply: false, dryRun: false })).toThrow("Missing --apply flag.");
    });
});
