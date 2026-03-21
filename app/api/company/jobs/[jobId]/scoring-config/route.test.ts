import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("app/shared/services/auth", () => ({ authOptions: {} }));
vi.mock("lib/prisma", () => ({
    default: {
        $transaction: vi.fn(),
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
vi.mock("../../jobHelpers", () => ({
    lockJobRow: vi.fn(),
}));

import { getServerSession } from "next-auth";
import prisma from "lib/prisma";
import { loadCompanyForUser } from "../../companyContext";
import { ensureCompanyRole } from "../../companyAuth";
import { lockJobRow } from "../../jobHelpers";
import { PUT } from "./route";

function makeRequest(body: unknown) {
    return {
        json: async () => body,
    } as any;
}

function makeContext(jobId = "job-1") {
    return { params: Promise.resolve({ jobId }) } as any;
}

function makeTx(scoringConfiguration: unknown) {
    return {
        $queryRaw: vi.fn(),
        job: {
            findUnique: vi.fn().mockResolvedValue({
                id: "job-1",
                companyId: "company-1",
                scoringConfiguration,
            }),
        },
        scoringConfiguration: {
            upsert: vi.fn().mockResolvedValue({
                jobId: "job-1",
                aiAssistWeight: 25,
                problemSolvingWeight: 25,
                experienceWeight: 50,
                codingWeight: 50,
            }),
        },
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    (getServerSession as any).mockResolvedValue({
        user: { id: "user-1", role: "COMPANY" },
    });
    (ensureCompanyRole as any).mockReturnValue(undefined);
    (loadCompanyForUser as any).mockResolvedValue({
        company: { id: "company-1" },
    });
});

describe("PUT /api/company/jobs/[jobId]/scoring-config", () => {
    it("returns 400 when aiAssistWeight and problemSolvingWeight exceed 100", async () => {
        const tx = makeTx(null);
        (prisma.$transaction as any).mockImplementation(async (callback: any) =>
            callback(tx)
        );

        const response = await PUT(
            makeRequest({ aiAssistWeight: 70, problemSolvingWeight: 40 }),
            makeContext()
        );
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toContain("cannot sum to more than 100");
        expect(lockJobRow).toHaveBeenCalledWith(tx, "job-1");
        expect(tx.scoringConfiguration.upsert).not.toHaveBeenCalled();
    });

    it("returns 400 when the locked current config makes a partial update invalid", async () => {
        const tx = makeTx({
            aiAssistWeight: 25,
            problemSolvingWeight: 40,
            experienceWeight: 50,
            codingWeight: 50,
        });
        (prisma.$transaction as any).mockImplementation(async (callback: any) =>
            callback(tx)
        );

        const response = await PUT(
            makeRequest({ aiAssistWeight: 70 }),
            makeContext()
        );
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toContain("cannot sum to more than 100");
        expect(tx.scoringConfiguration.upsert).not.toHaveBeenCalled();
    });

    it("returns 400 for non-numeric weight values", async () => {
        const tx = makeTx(null);
        (prisma.$transaction as any).mockImplementation(async (callback: any) =>
            callback(tx)
        );

        const response = await PUT(
            makeRequest({ aiAssistWeight: null }),
            makeContext()
        );
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe("aiAssistWeight must be a non-negative number");
        expect(tx.scoringConfiguration.upsert).not.toHaveBeenCalled();
    });

    it("accepts valid workstyle weights at or below 100", async () => {
        const tx = makeTx(null);
        (prisma.$transaction as any).mockImplementation(async (callback: any) =>
            callback(tx)
        );

        const response = await PUT(
            makeRequest({ aiAssistWeight: 60, problemSolvingWeight: 40 }),
            makeContext()
        );

        expect(response.status).toBe(200);
        expect(tx.scoringConfiguration.upsert).toHaveBeenCalled();
    });

    it("accepts a valid partial workstyle update against the existing config", async () => {
        const tx = makeTx({
            aiAssistWeight: 25,
            problemSolvingWeight: 30,
            experienceWeight: 50,
            codingWeight: 50,
        });
        (prisma.$transaction as any).mockImplementation(async (callback: any) =>
            callback(tx)
        );

        const response = await PUT(
            makeRequest({ aiAssistWeight: 70 }),
            makeContext()
        );

        expect(response.status).toBe(200);
        expect(tx.scoringConfiguration.upsert).toHaveBeenCalledWith({
            where: { jobId: "job-1" },
            create: {
                jobId: "job-1",
                aiAssistWeight: 70,
                problemSolvingWeight: 30,
                experienceWeight: 50,
                codingWeight: 50,
            },
            update: {
                aiAssistWeight: 70,
                problemSolvingWeight: 30,
                experienceWeight: 50,
                codingWeight: 50,
            },
        });
    });
});
