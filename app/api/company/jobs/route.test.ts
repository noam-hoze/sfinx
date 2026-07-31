import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }));
vi.mock("app/shared/services", () => ({
    log: { error: vi.fn(), info: vi.fn() },
}));
vi.mock("app/shared/services/server", () => ({
    authOptions: {},
    prisma: { $transaction: vi.fn() },
    invalidatePattern: vi.fn(),
}));
vi.mock("./companyContext", () => ({
    loadCompanyForUser: vi.fn(),
}));
vi.mock("./categorySchemas", () => ({
    parseCodingCategories: vi.fn((value) => value ?? null),
    parseExperienceCategories: vi.fn((value) => value ?? null),
}));
vi.mock("./companyAuth", () => ({
    ensureCompanyRole: vi.fn(),
}));
vi.mock("./jobHelpers", () => ({
    coerceSeconds: vi.fn(),
    mapJobResponse: vi.fn(),
}));

import { getServerSession } from "next-auth/next";
import { prisma } from "app/shared/services/server";
import { loadCompanyForUser } from "./companyContext";
import { POST } from "./route";

function makeRequest(body: unknown) {
    return {
        url: "http://localhost/api/company/jobs",
        json: async () => body,
    } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
    (getServerSession as any).mockResolvedValue({
        user: { id: "user-1", role: "COMPANY" },
    });
});

describe("POST /api/company/jobs", () => {
    it("rejects invalid scoring config before starting a transaction", async () => {
        const response = await POST(
            makeRequest({
                title: "Backend Engineer",
                location: "Remote",
                type: "FULL_TIME",
                scoringConfig: {
                    aiAssistWeight: 25,
                    problemSolvingWeight: 25,
                    experienceWeight: 50,
                    codingWeight: -1,
                },
            })
        );
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe("codingWeight must be a non-negative number");
        expect(loadCompanyForUser).not.toHaveBeenCalled();
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });
});
