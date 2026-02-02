/**
 * Generates coding and experience categories from a job description.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import OpenAI from "openai";
import { log } from "app/shared/services";
import { authOptions } from "app/shared/services/server";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";
import { categoryGenerationSchema } from "../categorySchemas";
import { ensureCompanyRole } from "../companyAuth";

const LOG_CATEGORY = LOG_CATEGORIES.OPENAI;

/**
 * Resolves the OpenAI API key from server environment variables.
 */
function resolveOpenAiKey(): string {
    const serverKey = process.env.OPENAI_API_KEY;
    if (serverKey) return serverKey;
    const publicKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    if (publicKey) return publicKey;
    throw new Error("OpenAI API key not configured");
}

/**
 * Builds logging context for category generation requests.
 */
function buildLogContext(request: NextRequest, userId: string) {
    return {
        requestId: request.headers.get("x-request-id"),
        userId,
    };
}

/**
 * Normalizes OpenAI response by converting arrays to strings.
 */
function normalizeGenerationResponse(response: any) {
    if (response.jobFields) {
        if (Array.isArray(response.jobFields.requirements)) {
            response.jobFields.requirements = response.jobFields.requirements.join("\n");
        }
    }
    return response;
}

/**
 * Generates category suggestions from the OpenAI API.
 */
async function requestCategoryGeneration(input: {
    description: string;
    title: string | null;
    customPrompt: string | null;
}) {
    const promptTitle = input.title ? `Title: ${input.title}\n` : "";
    const baseSystemPrompt = `You generate job interview definitions from job descriptions.\n` +
        `Return JSON with keys: experienceCategories, codingCategories, jobFields, interviewContent.\n` +
        `- experienceCategories: 4-6 items with {name, description, example, weight}, weights sum to 100\n` +
        `- codingCategories: 4-6 items with {name, description, weight}, weights sum to 100\n` +
        `- jobFields: {title, location, type (FULL_TIME/PART_TIME/CONTRACT), salary (format: "$160k" or "$120k - $180k", not text), requirements}\n` +
        `- interviewContent: {backgroundQuestion (opening question about relevant project), codingPrompt, codingTemplate (starter code), codingAnswer (reference solution), expectedOutput, codingLanguage}`;
    
    const systemPrompt = input.customPrompt 
        ? `${input.customPrompt}\n\n${baseSystemPrompt}`
        : baseSystemPrompt;
    
    const userPrompt = `${promptTitle}Description:\n${input.description}`;

    const openaiClient = new OpenAI({ apiKey: resolveOpenAiKey() });
    const completion = await openaiClient.chat.completions.create({
        model: "gpt-4o",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
        throw new Error("OpenAI returned empty response");
    }
    const parsed = JSON.parse(responseText);
    const normalized = normalizeGenerationResponse(parsed);
    return categoryGenerationSchema.parse(normalized);
}

/**
 * Extracts the company user id from the session.
 */
function requireCompanyUserId(session: Session | null): string {
    const sessionUser = session?.user as { id?: string } | undefined;
    if (!sessionUser?.id) {
        throw new Error("Unauthorized");
    }
    ensureCompanyRole(session);
    return String(sessionUser.id);
}

/**
 * Reads and validates the job category generation request body.
 */
async function readCategoryRequest(request: NextRequest) {
    const body = await request.json();
    if (typeof body.description !== "string") {
        throw new Error("Job description is required");
    }
    const description = body.description.trim();
    if (description.length === 0) {
        throw new Error("Job description is required");
    }
    if (typeof body.title !== "string") {
        return { description, title: null, customPrompt: null };
    }
    const title = body.title.trim();
    const customPrompt = typeof body.prompt === "string" ? body.prompt.trim() : null;
    return { 
        description, 
        title: title.length > 0 ? title : null,
        customPrompt: customPrompt && customPrompt.length > 0 ? customPrompt : null
    };
}

/**
 * Handles the category generation flow with logging.
 */
async function handleCategoryGeneration(request: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = requireCompanyUserId(session);
    const { description, title, customPrompt } = await readCategoryRequest(request);
    const context = buildLogContext(request, userId);

    log.info(LOG_CATEGORY, "[job-categories] Requesting category generation", {
        ...context,
        descriptionLength: description.length,
        hasTitle: Boolean(title),
        hasCustomPrompt: Boolean(customPrompt),
    });

    const generated = await requestCategoryGeneration({ description, title, customPrompt });
    log.info(LOG_CATEGORY, "[job-categories] Categories generated", {
        ...context,
        codingCount: generated.codingCategories.length,
        experienceCount: generated.experienceCategories.length,
    });

    return NextResponse.json(generated);
}

/**
 * Builds an error response for category generation failures.
 */
function buildErrorResponse(error: unknown) {
    log.error(LOG_CATEGORY, "[job-categories] Failed to generate categories", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "Unauthorized") {
        return NextResponse.json({ error: message }, { status: 401 });
    }
    if (message === "Job description is required") {
        return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json(
        { error: "Failed to generate categories", details: message },
        { status: 500 }
    );
}

export async function POST(request: NextRequest) {
    try {
        return await handleCategoryGeneration(request);
    } catch (error) {
        return buildErrorResponse(error);
    }
}
