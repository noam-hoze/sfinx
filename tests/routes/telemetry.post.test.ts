import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "node:path";

const prismaMock = {
    telemetryData: { findUnique: vi.fn(), create: vi.fn() },
    interviewSession: { findFirst: vi.fn() },
    workstyleMetrics: { create: vi.fn() },
    gapAnalysis: { create: vi.fn() },
    $transaction: vi.fn(async (cb: any) => cb(prismaMock)),
};

vi.mock("@prisma/client", () => {
    class PrismaClient {
        telemetryData = prismaMock.telemetryData;
        interviewSession = prismaMock.interviewSession as any;
        workstyleMetrics = prismaMock.workstyleMetrics as any;
        gapAnalysis = prismaMock.gapAnalysis as any;
        $transaction = prismaMock.$transaction as any;
    }
    return { PrismaClient };
});

vi.mock("next-auth/next", () => ({
    getServerSession: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
}));

async function importRoute() {
    const routePath = path.resolve(
        "/Users/noonejoze/Projects/sfinx/app/api/interviews/session/telemetry/route.ts"
    );
    return import(routePath);
}

function makeRequest(body: unknown) {
    return { json: async () => body } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("POST /api/interviews/session/telemetry", () => {
    it("creates zeroed telemetry when missing", async () => {
        prismaMock.telemetryData.findUnique.mockResolvedValue(null);
        prismaMock.interviewSession.findFirst.mockResolvedValue({
            id: "sess-1",
            candidateId: "user-1",
        });
        prismaMock.telemetryData.create.mockResolvedValue({
            id: "tel-1",
            matchScore: 0,
            confidence: "Unknown",
            story: "",
            hasFairnessFlag: false,
        });

        const { POST } = await importRoute();
        const res = await POST(makeRequest({ interviewSessionId: "sess-1" }));
        const json = await (res as any).json();

        expect(res.status).toBe(200);
        expect(json.telemetryData).toEqual(
            expect.objectContaining({
                id: "tel-1",
                matchScore: 0,
                confidence: "Unknown",
                story: "",
            })
        );
        // Ensure dependent models were created in transaction
        expect(prismaMock.workstyleMetrics.create).toHaveBeenCalled();
        expect(prismaMock.gapAnalysis.create).toHaveBeenCalled();
    });

    it("returns existing telemetry without creating a duplicate", async () => {
        prismaMock.telemetryData.findUnique.mockResolvedValue({
            id: "tel-existing",
            matchScore: 0,
            confidence: "Unknown",
            story: "",
        });

        const { POST } = await importRoute();
        const res = await POST(makeRequest({ interviewSessionId: "sess-1" }));
        const json = await (res as any).json();

        expect(res.status).toBe(200);
        expect(json.telemetryData.id).toBe("tel-existing");
        expect(prismaMock.telemetryData.create).not.toHaveBeenCalled();
    });
});
