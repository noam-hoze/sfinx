/**
 * Unit tests for backfill-final-scores helpers.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { resolveDatabaseUrl, requireNumber, requireValue } from "../backfill-final-scores";
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
