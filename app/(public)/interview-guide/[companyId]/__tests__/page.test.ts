/**
 * Unit tests for the InterviewGuidePage server component.
 * Verifies 404 behavior for missing company and null config.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---
vi.mock("lib/prisma", () => ({ default: { company: { findUnique: vi.fn() } } }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }) }));

import prisma from "lib/prisma";
import { notFound } from "next/navigation";

/** Minimal valid config for happy-path tests. */
const validConfig = {
    hero: { tagline: "Join us", imageUrl: "https://example.com/hero.jpg" },
    culture: { missionText: "Our mission" },
    stages: [
        { title: "AI Screening", shortDescription: "s", duration: "30m", format: "Voice", who: "AI", description: "d", whatToExpect: [], howToPrepare: [] },
        { title: "First Interview", shortDescription: "s", duration: "45m", format: "Video", who: "Team", description: "d", whatToExpect: [], howToPrepare: [] },
        { title: "Second Interview", shortDescription: "s", duration: "60m", format: "Video", who: "Lead", description: "d", whatToExpect: [], howToPrepare: [] },
        { title: "CEO Conversation", shortDescription: "s", duration: "30m", format: "Video", who: "CEO", description: "d", whatToExpect: [], howToPrepare: [] },
    ],
    tips: [{ title: "Tip", description: "Desc", tags: [] }],
    teamPhotos: [],
};

/** Minimal company record. */
const baseCompany = {
    id: "company-1",
    name: "Acme",
    logo: null,
    industry: "Tech",
    locations: [],
    cultureTags: [],
    size: "STARTUP",
    website: null,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
};

beforeEach(() => vi.clearAllMocks());

describe("InterviewGuidePage — 404 behavior", () => {
    it("calls notFound when company does not exist", async () => {
        (prisma.company.findUnique as any).mockResolvedValue(null);
        const { default: Page } = await import("../page");
        await expect(Page({ params: Promise.resolve({ companyId: "bad-id" }) })).rejects.toThrow("NEXT_NOT_FOUND");
        expect(notFound).toHaveBeenCalledOnce();
    });

    it("calls notFound when interviewGuideConfig is null", async () => {
        (prisma.company.findUnique as any).mockResolvedValue({ ...baseCompany, interviewGuideConfig: null });
        const { default: Page } = await import("../page");
        await expect(Page({ params: Promise.resolve({ companyId: "company-1" }) })).rejects.toThrow("NEXT_NOT_FOUND");
        expect(notFound).toHaveBeenCalledOnce();
    });
});

describe("InterviewGuidePage — happy path", () => {
    it("does not call notFound when company and config are present", async () => {
        (prisma.company.findUnique as any).mockResolvedValue({ ...baseCompany, interviewGuideConfig: validConfig });
        const { default: Page } = await import("../page");
        try {
            await Page({ params: Promise.resolve({ companyId: "company-1" }) });
        } catch {
            // JSX render may throw in Node env — only care that notFound was not invoked
        }
        expect(notFound).not.toHaveBeenCalled();
    });
});
