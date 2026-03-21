import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }));
vi.mock("app/shared/services", () => ({
    log: { error: vi.fn(), info: vi.fn() },
}));
vi.mock("app/shared/services/server", () => ({
    authOptions: {},
    prisma: {
        $transaction: vi.fn(),
        job: { findUnique: vi.fn() },
    },
    invalidatePattern: vi.fn(),
    invalidate: vi.fn(),
}));
vi.mock("../companyContext", () => ({
    loadCompanyForUser: vi.fn(),
}));
vi.mock("../companyAuth", () => ({
    ensureCompanyRole: vi.fn(),
}));
vi.mock("../jobHelpers", () => ({
    JOB_RESPONSE_INCLUDE: {
        company: true,
        interviewContent: true,
        scoringConfiguration: true,
    },
    coerceSeconds: vi.fn(),
    lockJobRow: vi.fn(),
    mapJobResponse: vi.fn(),
}));

import { getServerSession } from "next-auth/next";
import { prisma } from "app/shared/services/server";
import { loadCompanyForUser } from "../companyContext";
import { lockJobRow, mapJobResponse } from "../jobHelpers";
import { PUT } from "./route";

function makeRequest(body: unknown) {
    return {
        url: "http://localhost/api/company/jobs/job-1",
        json: async () => body,
    } as any;
}

function makeContext(jobId = "job-1") {
    return { params: Promise.resolve({ jobId }) } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
    (getServerSession as any).mockResolvedValue({
        user: { id: "user-1", role: "COMPANY" },
    });
    (loadCompanyForUser as any).mockResolvedValue({
        company: { id: "company-1" },
    });
    (prisma.job.findUnique as any).mockResolvedValue({
        id: "job-1",
        companyId: "company-1",
        interviewContentId: null,
        interviewContent: null,
        company: { id: "company-1" },
        scoringConfiguration: {
            aiAssistWeight: 25,
            problemSolvingWeight: 25,
            experienceWeight: 50,
            codingWeight: 50,
        },
    });
});

describe("PUT /api/company/jobs/[jobId]", () => {
    it("rejects invalid scoring config after loading the locked job", async () => {
        const tx = {
            $queryRaw: vi.fn(),
            job: {
                findUniqueOrThrow: vi.fn().mockResolvedValue({
                    id: "job-1",
                    company: { id: "company-1" },
                    interviewContent: null,
                    scoringConfiguration: {
                        aiAssistWeight: 25,
                        problemSolvingWeight: 25,
                        experienceWeight: 50,
                        codingWeight: 50,
                    },
                }),
                update: vi.fn(),
            },
            scoringConfiguration: {
                upsert: vi.fn(),
            },
        };
        (prisma.$transaction as any).mockImplementation(async (callback: any) =>
            callback(tx)
        );

        const response = await PUT(
            makeRequest({
                title: "Updated title",
                scoringConfig: {
                    aiAssistWeight: 25,
                    problemSolvingWeight: 25,
                    experienceWeight: 120,
                    codingWeight: 10,
                },
            }),
            makeContext()
        );
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe(
            "Experience weight and coding weight must sum to 100"
        );
        expect(prisma.$transaction).toHaveBeenCalled();
        expect(lockJobRow).toHaveBeenCalledWith(tx, "job-1");
        expect(tx.scoringConfiguration.upsert).not.toHaveBeenCalled();
    });

    it("validates partial scoring config against the locked current config", async () => {
        const tx = {
            $queryRaw: vi.fn(),
            job: {
                findUniqueOrThrow: vi.fn().mockResolvedValue({
                    id: "job-1",
                    company: { id: "company-1" },
                    interviewContent: null,
                    scoringConfiguration: {
                        aiAssistWeight: 25,
                        problemSolvingWeight: 40,
                        experienceWeight: 50,
                        codingWeight: 50,
                    },
                }),
                update: vi.fn(),
            },
            scoringConfiguration: {
                upsert: vi.fn(),
            },
        };
        (prisma.$transaction as any).mockImplementation(async (callback: any) =>
            callback(tx)
        );

        const response = await PUT(
            makeRequest({ scoringConfig: { aiAssistWeight: 70 } }),
            makeContext()
        );
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toContain("cannot sum to more than 100");
        expect(tx.scoringConfiguration.upsert).not.toHaveBeenCalled();
    });

    it("returns the refreshed scoring config after an atomic save", async () => {
        const updatedConfig = {
            aiAssistWeight: 30,
            problemSolvingWeight: 20,
            experienceWeight: 40,
            codingWeight: 60,
        };
        const tx = {
            $queryRaw: vi.fn(),
            job: {
                update: vi.fn().mockResolvedValue({}),
                findUniqueOrThrow: vi
                    .fn()
                    .mockResolvedValueOnce({
                        id: "job-1",
                        company: { id: "company-1" },
                        interviewContent: null,
                        scoringConfiguration: {
                            aiAssistWeight: 25,
                            problemSolvingWeight: 25,
                            experienceWeight: 50,
                            codingWeight: 50,
                        },
                    })
                    .mockResolvedValueOnce({
                        id: "job-1",
                        company: { id: "company-1" },
                        interviewContent: null,
                        scoringConfiguration: updatedConfig,
                    }),
            },
            scoringConfiguration: {
                upsert: vi.fn().mockResolvedValue({
                    jobId: "job-1",
                    ...updatedConfig,
                }),
            },
        };
        (prisma.$transaction as any).mockImplementation(async (callback: any) =>
            callback(tx)
        );
        (mapJobResponse as any).mockImplementation((job: any) => ({
            id: job.id,
            scoringConfig: job.scoringConfiguration,
        }));

        const response = await PUT(
            makeRequest({ title: "Updated title", scoringConfig: updatedConfig }),
            makeContext()
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(tx.scoringConfiguration.upsert).toHaveBeenCalledWith({
            where: { jobId: "job-1" },
            create: { jobId: "job-1", ...updatedConfig },
            update: updatedConfig,
        });
        expect(lockJobRow).toHaveBeenCalledWith(tx, "job-1");
        expect(tx.job.findUniqueOrThrow).toHaveBeenCalled();
        expect(body.scoringConfig).toEqual(updatedConfig);
    });
});
