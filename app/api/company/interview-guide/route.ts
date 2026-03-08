/**
 * API route for reading and updating a company's interview guide configuration.
 * GET  — returns current interviewGuideConfig (may be null).
 * PUT  — validates and persists a complete InterviewGuideConfig.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { log } from "app/shared/services";
import { authOptions, prisma } from "app/shared/services/server";
import { ensureCompanyRole } from "app/api/company/jobs/companyAuth";
import { loadCompanyForUser } from "app/api/company/jobs/companyContext";
import type { InterviewGuideConfig } from "app/shared/types/interviewGuide";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEW_GUIDE;

/** Resolves the authenticated company or throws with an HTTP-ready error. */
async function resolveCompany(request: NextRequest) {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as { id?: string } | undefined;
    if (!sessionUser?.id) throw Object.assign(new Error("Unauthorized"), { status: 401 });
    ensureCompanyRole(session);
    return loadCompanyForUser(String(sessionUser.id));
}

/** Validates that body is a complete InterviewGuideConfig. */
function validateConfig(body: unknown): body is InterviewGuideConfig {
    if (!body || typeof body !== "object") return false;
    const b = body as Record<string, unknown>;
    if (!b.hero || !b.culture || !Array.isArray(b.stages) || !Array.isArray(b.tips)) return false;
    if ((b.stages as unknown[]).length < 1) return false;
    const stagesValid = (b.stages as unknown[]).every((s) => isValidStage(s));
    const tipsValid = (b.tips as unknown[]).every((t) => isValidTip(t));
    return stagesValid && tipsValid && isValidHero(b.hero) && isValidCulture(b.culture);
}

function isValidHero(hero: unknown): boolean {
    if (!hero || typeof hero !== "object") return false;
    const h = hero as Record<string, unknown>;
    return typeof h.tagline === "string" && h.tagline.trim() !== ""
        && typeof h.imageUrl === "string" && h.imageUrl.trim() !== "";
}

function isValidCulture(culture: unknown): boolean {
    if (!culture || typeof culture !== "object") return false;
    const c = culture as Record<string, unknown>;
    return typeof c.missionText === "string" && c.missionText.trim() !== "";
}

function isValidStage(stage: unknown): boolean {
    if (!stage || typeof stage !== "object") return false;
    const s = stage as Record<string, unknown>;
    const requiredStrings = ["title", "shortDescription", "duration", "format", "who", "description"];
    return requiredStrings.every((k) => typeof s[k] === "string" && (s[k] as string).trim() !== "")
        && Array.isArray(s.whatToExpect)
        && Array.isArray(s.howToPrepare);
}

function isValidTip(tip: unknown): boolean {
    if (!tip || typeof tip !== "object") return false;
    const t = tip as Record<string, unknown>;
    return typeof t.title === "string" && t.title.trim() !== ""
        && typeof t.description === "string" && t.description.trim() !== ""
        && Array.isArray(t.tags);
}

/** GET /api/company/interview-guide */
export async function GET(request: NextRequest) {
    try {
        const { company } = await resolveCompany(request);
        log.info(LOG_CATEGORY, "Fetching interview guide config", { companyId: company.id });
        return NextResponse.json({ config: company.interviewGuideConfig, companyId: company.id });
    } catch (error) {
        return handleError(error, "fetch interview guide config");
    }
}

/** PUT /api/company/interview-guide */
export async function PUT(request: NextRequest) {
    try {
        const { company } = await resolveCompany(request);
        const body = await request.json();
        if (!validateConfig(body)) {
            log.warn(LOG_CATEGORY, "Invalid interview guide config body", { companyId: company.id });
            return NextResponse.json({ error: "Invalid config: all fields required, at least 1 stage" }, { status: 400 });
        }
        const updated = await (prisma as any).company.update({
            where: { id: company.id },
            data: { interviewGuideConfig: body },
            select: { interviewGuideConfig: true },
        });
        log.info(LOG_CATEGORY, "Interview guide config saved", { companyId: company.id });
        return NextResponse.json({ config: updated.interviewGuideConfig });
    } catch (error) {
        return handleError(error, "save interview guide config");
    }
}

/** Maps caught errors to NextResponse. */
function handleError(error: unknown, action: string): NextResponse {
    log.error(LOG_CATEGORY, `Failed to ${action}`, error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = (error as any)?.status ?? (message === "Company role required" ? 403 : 500);
    return NextResponse.json({ error: message }, { status });
}
