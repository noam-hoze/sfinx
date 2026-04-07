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
vi.mock("../../companyContext", () => ({ loadCompanyForUser: vi.fn() }));
vi.mock("../../companyAuth", () => ({ ensureCompanyRole: vi.fn() }));
vi.mock("app/shared/services", () => ({ log: { info: vi.fn(), error: vi.fn() } }));

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
});

describe("PUT /api/company/jobs/[jobId]/scoring-config", () => {
    it("rejects when aiAssistWeight + problemSolvingWeight exceeds 100", async () => {
        (prisma as any).job.findUnique.mockResolvedValue({
            id: "job-1",
            companyId: "company-1",
            scoringConfiguration: { aiAssistWeight: 25, problemSolvingWeight: 25 },
        });

        const response = await PUT(
            makeRequest({ aiAssistWeight: 70, problemSolvingWeight: 40 }),
            makeContext()
        );
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe("aiAssistWeight and problemSolvingWeight must sum to 100 or less");
        expect((prisma as any).scoringConfiguration.upsert).not.toHaveBeenCalled();
    });

    it("rejects partial updates that would exceed 100 using existing config values", async () => {
        (prisma as any).job.findUnique.mockResolvedValue({
            id: "job-1",
            companyId: "company-1",
            scoringConfiguration: { aiAssistWeight: 30, problemSolvingWeight: 30 },
        });

        const response = await PUT(
            makeRequest({ problemSolvingWeight: 80 }),
            makeContext()
        );

        expect(response.status).toBe(400);
        expect((prisma as any).scoringConfiguration.upsert).not.toHaveBeenCalled();
    });

    it("allows valid combined workstyle weights and persists update", async () => {
        (prisma as any).job.findUnique.mockResolvedValue({
            id: "job-1",
            companyId: "company-1",
            scoringConfiguration: { aiAssistWeight: 20, problemSolvingWeight: 20 },
        });
        (prisma as any).scoringConfiguration.upsert.mockResolvedValue({
            jobId: "job-1",
            aiAssistWeight: 60,
            problemSolvingWeight: 40,
        });

        const response = await PUT(
            makeRequest({ aiAssistWeight: 60, problemSolvingWeight: 40 }),
            makeContext()
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.config.aiAssistWeight).toBe(60);
        expect(body.config.problemSolvingWeight).toBe(40);
        expect((prisma as any).scoringConfiguration.upsert).toHaveBeenCalledTimes(1);
    });
});
