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
 * Generates category suggestions from the OpenAI API.
 */
async function requestCategoryGeneration(input: {
    description: string;
    title: string | null;
}) {
    const promptTitle = input.title ? `Title: ${input.title}\n` : "";
    const systemPrompt = `You generate job interview category definitions.\n` +
        `Return JSON only with keys: experienceCategories, codingCategories.\n` +
        `Each array should have 4-6 items with {name, description, weight} and experience items also include {example}.\n` +
        `Weights must be integers that sum to 100 for each array.`;
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
    return categoryGenerationSchema.parse(JSON.parse(responseText));
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
        return { description, title: null };
    }
    const title = body.title.trim();
    return { description, title: title.length > 0 ? title : null };
}

/**
 * Handles the category generation flow with logging.
 */
async function handleCategoryGeneration(request: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = requireCompanyUserId(session);
    const { description, title } = await readCategoryRequest(request);
    const context = buildLogContext(request, userId);

    log.info(LOG_CATEGORY, "[job-categories] Requesting category generation", {
        ...context,
        descriptionLength: description.length,
        hasTitle: Boolean(title),
    });

    const generated = await requestCategoryGeneration({ description, title });
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
