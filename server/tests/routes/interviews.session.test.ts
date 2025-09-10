import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "node:path";

// Local prisma mock instance to align with route's internal PrismaClient usage
const txMocks = {
    interviewSession: { create: vi.fn() },
    telemetryData: { create: vi.fn() },
    workstyleMetrics: { create: vi.fn() },
    gapAnalysis: { create: vi.fn() },
};

const prismaMock = {
    application: { findFirst: vi.fn() },
    $transaction: vi.fn(async (cb: any) => cb(txMocks)),
};

// Mock global PrismaClient by intercepting @prisma/client constructor
vi.mock("@prisma/client", () => {
    class PrismaClient {
        application = prismaMock.application;
        $transaction = prismaMock.$transaction as any;
    }
    return { PrismaClient };
});

vi.mock("next-auth/next", () => ({
    getServerSession: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
}));
vi.mock("/Users/noonejoze/Projects/sfinx/lib/index.ts", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

async function importRoute() {
    const routePath = path.resolve(
        "/Users/noonejoze/Projects/sfinx/app/api/interviews/session/route.ts"
    );
    return import(routePath);
}

function makeRequest(body: unknown) {
    return { json: async () => body } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("POST /api/interviews/session", () => {
    it("creates session linked to application and zeroed telemetry", async () => {
        // Arrange
        prismaMock.application.findFirst.mockResolvedValue({
            id: "app-1",
            candidateId: "user-1",
        });
        txMocks.interviewSession.create.mockResolvedValue({
            id: "sess-1",
            candidateId: "user-1",
            applicationId: "app-1",
        });
        txMocks.telemetryData.create.mockResolvedValue({ id: "tel-1" });

        const { POST } = await importRoute();

        // Act
        const res = await POST(
            makeRequest({ applicationId: "app-1", companyId: "comp-1" })
        );
        const json = await (res as any).json();

        // Assert session
        expect(res.status).toBe(200);
        expect(json.interviewSession.id).toBe("sess-1");
        expect(txMocks.interviewSession.create).toHaveBeenCalledWith({
            data: {
                candidateId: "user-1",
                applicationId: "app-1",
                status: "IN_PROGRESS",
            },
        });

        // Assert telemetry created with zero/empty defaults
        expect(txMocks.telemetryData.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                interviewSessionId: "sess-1",
                matchScore: 0,
                confidence: "Unknown",
                story: "",
                hasFairnessFlag: false,
            }),
        });
        // Assert dependent structures created
        expect(txMocks.workstyleMetrics.create).toHaveBeenCalled();
        expect(txMocks.gapAnalysis.create).toHaveBeenCalled();
    });
});
