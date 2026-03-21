import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("app/shared/services/auth", () => ({ authOptions: {} }));
vi.mock("lib/prisma", () => ({
    default: {
        job: { findUnique: vi.fn() },
        scoringConfiguration: { upsert: vi.fn() },
    },
}));
vi.mock("app/shared/services", () => ({
    log: { info: vi.fn(), error: vi.fn() },
}));
vi.mock("../../companyContext", () => ({
    loadCompanyForUser: vi.fn(),
}));
vi.mock("../../companyAuth", () => ({
    ensureCompanyRole: vi.fn(),
}));

import { getServerSession } from "next-auth";
import prisma from "lib/prisma";
import { loadCompanyForUser } from "../../companyContext";
import { ensureCompanyRole } from "../../companyAuth";
import { PUT } from "./route";

function makeRequest(body: unknown) {
    return {
        json: async () => body,
    } as any;
}

function makeContext(jobId = "job-1") {
    return { params: Promise.resolve({ jobId }) } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
    (getServerSession as any).mockResolvedValue({ user: { id: "user-1", role: "COMPANY" } });
    (ensureCompanyRole as any).mockReturnValue(undefined);
    (loadCompanyForUser as any).mockResolvedValue({ company: { id: "company-1" } });
    (prisma.job.findUnique as any).mockResolvedValue({ id: "job-1", companyId: "company-1" });
    (prisma.scoringConfiguration.upsert as any).mockResolvedValue({
        jobId: "job-1",
        aiAssistWeight: 25,
        problemSolvingWeight: 25,
        experienceWeight: 50,
        codingWeight: 50,
    });
});

describe("PUT /api/company/jobs/[jobId]/scoring-config", () => {
    it("returns 400 when aiAssistWeight and problemSolvingWeight exceed 100", async () => {
        const response = await PUT(
            makeRequest({ aiAssistWeight: 70, problemSolvingWeight: 40 }),
            makeContext()
        );
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toContain("cannot sum to more than 100");
        expect(prisma.scoringConfiguration.upsert).not.toHaveBeenCalled();
    });

    it("accepts valid workstyle weights at or below 100", async () => {
        const response = await PUT(
            makeRequest({ aiAssistWeight: 60, problemSolvingWeight: 40 }),
            makeContext()
        );

        expect(response.status).toBe(200);
        expect(prisma.scoringConfiguration.upsert).toHaveBeenCalled();
    });
});
