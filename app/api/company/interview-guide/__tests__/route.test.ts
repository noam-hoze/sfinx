/**
 * Unit tests for GET/PUT /api/company/interview-guide.
 * Mocks Prisma and NextAuth to isolate route logic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { InterviewGuideConfig } from "app/shared/types/interviewGuide";

// --- Mocks ---
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }));
vi.mock("app/shared/services/server", () => ({
    authOptions: {},
    prisma: { company: { update: vi.fn() } },
    invalidatePattern: vi.fn(),
}));
vi.mock("app/api/company/jobs/companyAuth", () => ({ ensureCompanyRole: vi.fn() }));
vi.mock("app/api/company/jobs/companyContext", () => ({ loadCompanyForUser: vi.fn() }));
vi.mock("app/shared/services", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { getServerSession } from "next-auth/next";
import { prisma } from "app/shared/services/server";
import { ensureCompanyRole } from "app/api/company/jobs/companyAuth";
import { loadCompanyForUser } from "app/api/company/jobs/companyContext";
import { GET, PUT } from "../route";

/** Minimal valid InterviewGuideConfig for tests. */
const validConfig: InterviewGuideConfig = {
    hero: { tagline: "Join us", imageUrl: "https://example.com/hero.jpg" },
    culture: { missionText: "Our mission" },
    stages: [
        { title: "AI Screening", shortDescription: "Short", duration: "30min", format: "Voice", who: "AI", description: "Desc", whatToExpect: ["item"], howToPrepare: ["item"] },
        { title: "First Interview", shortDescription: "Short", duration: "45min", format: "Video", who: "Team", description: "Desc", whatToExpect: ["item"], howToPrepare: ["item"] },
        { title: "Second Interview", shortDescription: "Short", duration: "60min", format: "Video", who: "Lead", description: "Desc", whatToExpect: ["item"], howToPrepare: ["item"] },
        { title: "CEO Conversation", shortDescription: "Short", duration: "30min", format: "Video", who: "CEO", description: "Desc", whatToExpect: ["item"], howToPrepare: ["item"] },
    ],
    tips: [{ title: "Tip 1", description: "Desc", tags: ["tag"] }],
    teamPhotos: [],
};

/** Creates a minimal NextRequest-like object. */
function makeRequest(body?: unknown) {
    return {
        json: async () => body,
    } as any;
}

/** Sets up mocks for an authenticated COMPANY session. */
function mockAuthenticatedCompany(config: unknown = null) {
    (getServerSession as any).mockResolvedValue({ user: { id: "user-1", role: "COMPANY" } });
    (ensureCompanyRole as any).mockReturnValue(undefined);
    (loadCompanyForUser as any).mockResolvedValue({
        company: { id: "company-1", interviewGuideConfig: config },
    });
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/company/interview-guide", () => {
    it("returns null config when not yet configured", async () => {
        mockAuthenticatedCompany(null);
        const response = await GET(makeRequest());
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body.config).toBeNull();
    });

    it("returns existing config", async () => {
        mockAuthenticatedCompany(validConfig);
        const response = await GET(makeRequest());
        const body = await response.json();
        expect(body.config.hero.tagline).toBe("Join us");
    });

    it("returns 401 when unauthenticated", async () => {
        (getServerSession as any).mockResolvedValue(null);
        const response = await GET(makeRequest());
        expect(response.status).toBe(401);
    });

    it("returns 403 when not COMPANY role", async () => {
        (getServerSession as any).mockResolvedValue({ user: { id: "user-1" } });
        (ensureCompanyRole as any).mockImplementation(() => { throw new Error("Company role required"); });
        const response = await GET(makeRequest());
        expect(response.status).toBe(403);
    });
});

describe("PUT /api/company/interview-guide", () => {
    it("saves valid config and returns it", async () => {
        mockAuthenticatedCompany();
        (prisma as any).company.update.mockResolvedValue({ interviewGuideConfig: validConfig });
        const response = await PUT(makeRequest(validConfig));
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body.config.hero.tagline).toBe("Join us");
    });

    it("returns 400 when stages is empty", async () => {
        mockAuthenticatedCompany();
        const bad = { ...validConfig, stages: [] };
        const response = await PUT(makeRequest(bad));
        expect(response.status).toBe(400);
    });

    it("returns 400 when a required string field is empty", async () => {
        mockAuthenticatedCompany();
        const bad = { ...validConfig, hero: { tagline: "", imageUrl: "https://example.com/img.jpg" } };
        const response = await PUT(makeRequest(bad));
        expect(response.status).toBe(400);
    });

    it("returns 400 when body is missing culture", async () => {
        mockAuthenticatedCompany();
        const { culture: _culture, ...bad } = validConfig;
        const response = await PUT(makeRequest(bad));
        expect(response.status).toBe(400);
    });

    it("returns 401 when unauthenticated", async () => {
        (getServerSession as any).mockResolvedValue(null);
        const response = await PUT(makeRequest(validConfig));
        expect(response.status).toBe(401);
    });
});
