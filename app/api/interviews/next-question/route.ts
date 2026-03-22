import { NextRequest, NextResponse } from "next/server";
import { log } from "app/shared/services";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";
import prisma from "lib/prisma";
import OpenAI from "openai";
import { CONTRIBUTIONS_TARGET } from "shared/constants/interview";
import {
    buildClassificationPrompt,
    isGibberishAnswer,
    shouldIncrementRetryCounter,
    shouldMoveToNextQuestion,
    type AnswerType,
    type ProbeAngle,
    type ClassifiedQuestionResponse
} from "shared/services/backgroundInterview/answerClassification";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

type CategoryCount = {
    categoryName: string;
    count: number;
    avgStrength: number;
    dontKnowCount?: number;
};

/** Validates answer-type values returned by OpenAI. */
function isAnswerType(value: unknown): value is AnswerType {
    return value === "clarification_request" || value === "dont_know" || value === "substantive";
}

/** Validates probe-angle values returned by OpenAI. */
function isProbeAngle(value: unknown): value is ProbeAngle {
    return value === "implementation" ||
        value === "sizing" ||
        value === "correctness" ||
        value === "measurement" ||
        value === "observed_evidence" ||
        value === "failure_mode" ||
        value === "tradeoff" ||
        value === "redesign";
}

/** Validates constrained fingerprint slot values returned by OpenAI. */
function isProbeSlot(value: unknown): value is string {
    return value === "actual_number" ||
        value === "sizing_method" ||
        value === "overflow_policy" ||
        value === "observed_result" ||
        value === "instrumentation_tool" ||
        value === "failure_case" ||
        value === "concurrency_model" ||
        value === "ownership_rule" ||
        value === "deferred_work" ||
        value === "payload_shape" ||
        value === "tradeoff_choice" ||
        value === "redesign_point";
}

/** Ensures the OpenAI response matches the caller contract. */
function validateClassifiedResponse(result: ClassifiedQuestionResponse, expectedTopic: string) {
    if (!isAnswerType(result.detectedAnswerType) || typeof result.question !== "string" || !result.question.trim()) {
        throw new Error("OpenAI response missing required fields");
    }

    if (result.detectedAnswerType === "substantive") {
        if (!isProbeAngle(result.probeAngle) || !result.fingerprint) {
            throw new Error("Substantive response missing probe metadata");
        }

        if (
            result.fingerprint.topic !== expectedTopic ||
            result.fingerprint.angle !== result.probeAngle ||
            !isProbeSlot(result.fingerprint.slot)
        ) {
            throw new Error("Substantive response has inconsistent probe metadata");
        }
        return;
    }

    if (result.probeAngle != null || result.fingerprint != null) {
        throw new Error("Non-substantive response must not include probe metadata");
    }
}

/** Keeps clarification retries pinned to the current topic. */
function getResponseFocusTopic(
    answerType: AnswerType,
    currentFocusTopic: string | undefined,
    nextFocusTopic: string,
    shouldMoveOn: boolean
): string {
    if (answerType === "clarification_request" && !shouldMoveOn && currentFocusTopic) {
        return currentFocusTopic;
    }
    return nextFocusTopic;
}

/** Resolves covered angles for the topic selected in this response. */
function getCoveredAnglesForTopic(
    focusTopic: string,
    coveredAnglesByTopic: unknown,
    legacyCoveredAngles: unknown
): string[] {
    if (coveredAnglesByTopic && typeof coveredAnglesByTopic === "object" && !Array.isArray(coveredAnglesByTopic)) {
        const topicAngles = (coveredAnglesByTopic as Record<string, unknown>)[focusTopic];
        return Array.isArray(topicAngles)
            ? topicAngles.filter((angle): angle is string => typeof angle === "string")
            : [];
    }

    return Array.isArray(legacyCoveredAngles)
        ? legacyCoveredAngles.filter((angle): angle is string => typeof angle === "string")
        : [];
}

/** Builds the compact category status list used in the prompt. */
function buildCategoryList(
    activeCategories: Array<{ name: string }>,
    counts: CategoryCount[]
): string {
    return activeCategories.map((cat) => {
        const stats = counts.find((count) => count.categoryName === cat.name);
        return `${cat.name}: ${stats?.count || 0} contributions (avg ${stats?.avgStrength || 0}%)`;
    }).join(", ");
}

/** Selects the next topic using the existing deterministic ranking rules. */
function selectFocusTopic(countsForSelection: CategoryCount[], target: number): string {
    const active = countsForSelection.filter((count) => count.count < target);
    const ranked = active.length > 0
        ? [...active].sort((a, b) => b.count - a.count || b.avgStrength - a.avgStrength)
        : [...countsForSelection].sort((a, b) => a.avgStrength - b.avgStrength);
    return ranked[0].categoryName;
}

/** Parses the dont-know exclusion threshold from env. */
function getDontKnowThreshold(): number {
    if (!process.env.NEXT_PUBLIC_DONT_KNOW_THRESHOLD) {
        throw new Error("NEXT_PUBLIC_DONT_KNOW_THRESHOLD environment variable is not set");
    }

    const threshold = parseInt(process.env.NEXT_PUBLIC_DONT_KNOW_THRESHOLD, 10);
    if (!Number.isFinite(threshold) || threshold < 1) {
        throw new Error("NEXT_PUBLIC_DONT_KNOW_THRESHOLD must be a positive integer");
    }
    return threshold;
}

/** Applies the current turn's confirmed dont-know count increment. */
function incrementDontKnowCount(
    counts: CategoryCount[],
    currentFocusTopic: string
): CategoryCount[] {
    return counts.map((count) =>
        count.categoryName === currentFocusTopic
            ? { ...count, dontKnowCount: (count.dontKnowCount ?? 0) + 1 }
            : count
    );
}

/** Returns the union of existing and threshold-crossing excluded topics. */
function getExcludedTopicsAfterClassification(
    counts: CategoryCount[],
    existingExcludedTopics: string[],
    threshold: number
): string[] {
    return [...new Set([
        ...existingExcludedTopics,
        ...counts
            .filter((count) => (count.dontKnowCount ?? 0) >= threshold)
            .map((count) => count.categoryName),
    ])];
}

/** Requests the OpenAI classified-question payload for a specific focus topic. */
async function requestQuestionResponse(params: {
    companyName?: string | null;
    jobTitle?: string | null;
    evaluationModel: string;
    prompt: string;
    focusTopic: string;
    retryCount: number;
}) {
    const { companyName, jobTitle, evaluationModel, prompt, focusTopic, retryCount } = params;
    const messages = [
        {
            role: "system" as const,
            content: companyName && jobTitle
                ? `You are a technical interviewer at ${companyName} evaluating candidates for the ${jobTitle} position. Return valid JSON only.`
                : "You are a technical interviewer. Return valid JSON only.",
        },
        {
            role: "user" as const,
            content: prompt,
        },
    ];

    log.info(LOG_CATEGORY, "[next-question] OpenAI request", {
        model: evaluationModel,
        focusTopic,
        retryCount,
    });

    const startTime = Date.now();
    const completion = await openai.chat.completions.create({
        model: evaluationModel,
        messages,
        response_format: { type: "json_object" },
        max_completion_tokens: 4000,
    });
    const elapsed = Date.now() - startTime;
    const responseText = completion.choices[0]?.message?.content;
    const finishReason = completion.choices[0]?.finish_reason;

    log.info(LOG_CATEGORY, "[next-question] OpenAI response", {
        latencyMs: elapsed,
        finishReason,
        hasResponseText: Boolean(responseText),
    });

    if (!responseText) {
        throw new Error(`OpenAI returned empty response (finish_reason: ${finishReason})`);
    }

    try {
        return {
            elapsed,
            result: JSON.parse(responseText) as ClassifiedQuestionResponse,
        };
    } catch {
        throw new Error(`JSON parse failed. finish_reason=${finishReason}, raw=${responseText}`);
    }
}

/**
 * POST /api/interviews/next-question
 * Ultra-fast question generation (target <500ms) with NO scoring logic.
 * Part of split evaluation architecture for improved user experience.
 */
export async function POST(request: NextRequest) {
    try {
        // Feature flag check
        const useSplitEvaluation = process.env.NEXT_PUBLIC_USE_SPLIT_EVALUATION === 'true';
        if (!useSplitEvaluation) {
            return NextResponse.json(
                { error: "Split evaluation not enabled" },
                { status: 503 }
            );
        }

        const body = await request.json();
        const {
            sessionId,
            lastQuestion,
            lastAnswer,
            experienceCategories,
            currentCounts,
            currentFocusTopic,
            excludedTopics,
            clarificationRetryCount,
            recentHistory,
            coveredAnglesByTopic,
            coveredAngles,
            allPreviousProbes,
        } = body;

        if (!sessionId || !lastQuestion || lastAnswer === undefined || !experienceCategories || !currentCounts) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        if (!Array.isArray(excludedTopics)) {
            return NextResponse.json(
                { error: "excludedTopics must be an array" },
                { status: 400 }
            );
        }

        const CLARIFICATION_THRESHOLD = parseInt(
            process.env.NEXT_PUBLIC_CLARIFICATION_THRESHOLD || '3',
            10
        );
        const retryCount = clarificationRetryCount || 0;

        log.info(LOG_CATEGORY, "[next-question] Question generation started");

        // Fetch session to get company/job context (minimal fetch for speed)
        const session = await prisma.interviewSession.findUnique({
            where: { id: sessionId },
            include: {
                application: {
                    include: {
                        job: {
                            include: {
                                company: true,
                            },
                        },
                    },
                },
            },
        });

        if (!session?.application?.job) {
            throw new Error("Session or job not found");
        }

        const companyName = session.application.job.company?.name;
        const jobTitle = session.application.job.title;

        const evaluationModel = process.env.NEXT_PUBLIC_OPENAI_EVALUATION_MODEL;
        if (!evaluationModel) {
            throw new Error("NEXT_PUBLIC_OPENAI_EVALUATION_MODEL environment variable is not set");
        }

        // Filter out excluded categories
        const activeCategories = experienceCategories.filter(
            (cat: any) => !excludedTopics.includes(cat.name)
        );

        // Check if all categories excluded
        if (activeCategories.length === 0) {
            log.info(LOG_CATEGORY, "[next-question] All categories excluded - ending interview");
            return NextResponse.json({
                success: true,
                allCategoriesExcluded: true,
                question: null,
                newFocusTopic: null,
                isGibberish: false,
                isClarificationRequest: false,
                isDontKnow: false,
                shouldIncrementRetry: false,
                shouldMoveOn: false,
            });
        }

        // Build category list with current counts (using active categories only)
        const TARGET = CONTRIBUTIONS_TARGET;

        const categoryList = buildCategoryList(activeCategories, currentCounts);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // FAST DETECTION: Regex-based gibberish only (OpenAI handles classification)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        // GIBBERISH DETECTION: Check if answer is nonsensical or meaningless
        const isGibberish = isGibberishAnswer(lastAnswer);

        // Note: Clarification and "I don't know" detection moved to OpenAI classification
        // (more accurate, handles creative phrasings like "huh?", "sorry?", etc.)

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // DETERMINISTIC TOPIC SELECTION
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        const activeCategoryNames = activeCategories.map((cat: any) => cat.name);
        const countsForSelection = currentCounts.filter((count: CategoryCount) =>
            activeCategoryNames.includes(count.categoryName)
        );
        let newFocusTopic = selectFocusTopic(countsForSelection, TARGET);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // OPENAI PROMPT: QUESTION GENERATION WITH CLASSIFICATION
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        const safeRecentHistory = Array.isArray(recentHistory) ? recentHistory : [];
        const safePreviousProbes = Array.isArray(allPreviousProbes) ? allPreviousProbes : [];
        const initialPrompt = buildClassificationPrompt({
            lastQuestion,
            lastAnswer,
            categoryList,
            newFocusTopic,
            clarificationRetryCount: retryCount,
            clarificationThreshold: CLARIFICATION_THRESHOLD,
            isGibberish,
            recentHistory: safeRecentHistory,
            coveredAngles: getCoveredAnglesForTopic(newFocusTopic, coveredAnglesByTopic, coveredAngles),
            allPreviousProbes: safePreviousProbes,
        });
        const openAiStart = Date.now();
        let { result } = await requestQuestionResponse({
            companyName,
            jobTitle,
            evaluationModel,
            prompt: initialPrompt,
            focusTopic: newFocusTopic,
            retryCount,
        });

        validateClassifiedResponse(result, newFocusTopic);

        // Derive classification flags from OpenAI's judgment (single source of truth)
        const answerType: AnswerType = result.detectedAnswerType;
        const isClarificationRequest = answerType === 'clarification_request';
        const isDontKnow = answerType === 'dont_know';
        const shouldIncrementRetry = shouldIncrementRetryCounter(answerType, retryCount, CLARIFICATION_THRESHOLD);
        const shouldMoveOn = shouldMoveToNextQuestion(answerType, retryCount, CLARIFICATION_THRESHOLD);
        let responseFocusTopic = getResponseFocusTopic(
            answerType,
            currentFocusTopic,
            newFocusTopic,
            shouldMoveOn
        );

        if (isDontKnow && currentFocusTopic) {
            const threshold = getDontKnowThreshold();
            const projectedCounts = incrementDontKnowCount(currentCounts, currentFocusTopic);
            const nextExcludedTopics = getExcludedTopicsAfterClassification(
                projectedCounts,
                excludedTopics,
                threshold
            );
            const remainingCategories = experienceCategories.filter(
                (cat: any) => !nextExcludedTopics.includes(cat.name)
            );

            if (remainingCategories.length === 0) {
                log.info(LOG_CATEGORY, "[next-question] All categories excluded after confirmed dont_know");
                return NextResponse.json({
                    success: true,
                    allCategoriesExcluded: true,
                    question: null,
                    newFocusTopic: null,
                    isGibberish,
                    isClarificationRequest,
                    isDontKnow,
                    shouldIncrementRetry,
                    shouldMoveOn,
                });
            }

            const remainingCategoryNames = remainingCategories.map((cat: any) => cat.name);
            const correctedCounts = projectedCounts.filter((count) =>
                remainingCategoryNames.includes(count.categoryName)
            );
            const correctedFocusTopic = selectFocusTopic(correctedCounts, TARGET);

            if (correctedFocusTopic !== newFocusTopic) {
                const correctedPrompt = buildClassificationPrompt({
                    lastQuestion,
                    lastAnswer,
                    categoryList: buildCategoryList(remainingCategories, projectedCounts),
                    newFocusTopic: correctedFocusTopic,
                    clarificationRetryCount: retryCount,
                    clarificationThreshold: CLARIFICATION_THRESHOLD,
                    isGibberish,
                    recentHistory: safeRecentHistory,
                    coveredAngles: getCoveredAnglesForTopic(
                        correctedFocusTopic,
                        coveredAnglesByTopic,
                        coveredAngles
                    ),
                    allPreviousProbes: safePreviousProbes,
                });
                const regenerated = await requestQuestionResponse({
                    companyName,
                    jobTitle,
                    evaluationModel,
                    prompt: correctedPrompt,
                    focusTopic: correctedFocusTopic,
                    retryCount,
                });

                if (
                    regenerated.result.detectedAnswerType !== "dont_know" ||
                    regenerated.result.probeAngle != null ||
                    regenerated.result.fingerprint != null ||
                    typeof regenerated.result.question !== "string" ||
                    !regenerated.result.question.trim()
                ) {
                    throw new Error("OpenAI response missing required fields");
                }

                result = { ...result, question: regenerated.result.question };
                newFocusTopic = correctedFocusTopic;
            }

            responseFocusTopic = newFocusTopic;
        }
        const latencyMs = Date.now() - openAiStart;
        log.info(LOG_CATEGORY, `[next-question] Classification: ${answerType}, Question generated in ${latencyMs}ms`);

        return NextResponse.json({
            success: true,
            detectedAnswerType: answerType,
            question: result.question,
            newFocusTopic: responseFocusTopic,
            isGibberish,
            isClarificationRequest,
            isDontKnow,
            shouldIncrementRetry,
            shouldMoveOn,
            probeAngle: answerType === "substantive" ? result.probeAngle : null,
            fingerprint: answerType === "substantive" ? result.fingerprint : null,
            latencyMs,
        });
    } catch (error) {
        log.error(LOG_CATEGORY, "[next-question] ❌ Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
