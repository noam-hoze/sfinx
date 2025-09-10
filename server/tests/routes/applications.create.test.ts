import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "node:path";

// Mocks
const prismaMock = {
    company: { findUnique: vi.fn() },
    job: { findUnique: vi.fn() },
    application: { findFirst: vi.fn(), create: vi.fn() },
};

vi.mock("/Users/noonejoze/Projects/sfinx/lib/prisma.ts", () => ({
    prisma: prismaMock,
}));
vi.mock("next-auth/next", () => ({
    getServerSession: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
}));
vi.mock("/Users/noonejoze/Projects/sfinx/lib/index.ts", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

async function importRoute() {
    const routePath = path.resolve(
        "/Users/noonejoze/Projects/sfinx/app/api/applications/create/route.ts"
    );
    return import(routePath);
}

function makeRequest(body: unknown) {
    return { json: async () => body } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("POST /api/applications/create", () => {
    it("creates a new application when none exists", async () => {
        // Arrange
        prismaMock.company.findUnique.mockResolvedValue({
            id: "comp-1",
            name: "Acme",
        });
        prismaMock.job.findUnique.mockResolvedValue({
            id: "job-1",
            companyId: "comp-1",
        });
        prismaMock.application.findFirst.mockResolvedValue(null);
        prismaMock.application.create.mockResolvedValue({
            id: "app-1",
            candidateId: "user-1",
            jobId: "job-1",
        });

        const { POST } = await importRoute();

        // Act
        const res = await POST(
            makeRequest({ companyId: "comp-1", jobId: "job-1" })
        );
        const json = await (res as any).json();

        // Assert
        expect(res.status).toBe(200);
        expect(json.application.id).toBe("app-1");
        expect(prismaMock.application.create).toHaveBeenCalledWith({
            data: { candidateId: "user-1", jobId: "job-1", status: "PENDING" },
        });
    });

    it("reuses existing application for same candidate+job", async () => {
        // Arrange
        prismaMock.company.findUnique.mockResolvedValue({
            id: "comp-1",
            name: "Acme",
        });
        prismaMock.job.findUnique.mockResolvedValue({
            id: "job-1",
            companyId: "comp-1",
        });
        prismaMock.application.findFirst.mockResolvedValue({
            id: "app-existing",
            candidateId: "user-1",
            jobId: "job-1",
        });

        const { POST } = await importRoute();

        // Act
        const res = await POST(
            makeRequest({ companyId: "comp-1", jobId: "job-1" })
        );
        const json = await (res as any).json();

        // Assert
        expect(res.status).toBe(200);
        expect(json.application.id).toBe("app-existing");
        expect(prismaMock.application.create).not.toHaveBeenCalled();
    });
});
