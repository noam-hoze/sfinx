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
    type ClassifiedQuestionResponse
} from "shared/services/backgroundInterview/answerClassification";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

const openai = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

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
            clarificationRetryCount
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
        let activeCategories = experienceCategories.filter(
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

        const categoryList = activeCategories.map((cat: any) => {
            const stats = currentCounts.find((c: any) => c.categoryName === cat.name);
            return `${cat.name}: ${stats?.count || 0} contributions (avg ${stats?.avgStrength || 0}%)`;
        }).join(', ');

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
        let countsForSelection = currentCounts.filter((c: any) => activeCategoryNames.includes(c.categoryName));

        // Fast "I don't know" detection for topic selection (internal logic only)
        // OpenAI will provide the actual classification returned to frontend
        const isDontKnowForTopicSelection = /\b(I don't know|not sure|no experience|haven't worked with|unfamiliar with|can't recall)\b/i.test(lastAnswer);

        // If "I don't know" detected, increment dontKnowCount for current focus topic
        if (isDontKnowForTopicSelection && currentFocusTopic) {
            countsForSelection = countsForSelection.map((c: any) => {
                if (c.categoryName === currentFocusTopic) {
                    return { ...c, dontKnowCount: c.dontKnowCount + 1 };
                }
                return c;
            });

            // Re-compute exclusions with incremented count
            if (!process.env.NEXT_PUBLIC_DONT_KNOW_THRESHOLD) {
                throw new Error("NEXT_PUBLIC_DONT_KNOW_THRESHOLD environment variable is not set");
            }
            const threshold = parseInt(process.env.NEXT_PUBLIC_DONT_KNOW_THRESHOLD, 10);
            if (!Number.isFinite(threshold) || threshold < 1) {
                throw new Error("NEXT_PUBLIC_DONT_KNOW_THRESHOLD must be a positive integer");
            }

            const newExcludedTopics = countsForSelection
                .filter((c: any) => c.dontKnowCount >= threshold)
                .map((c: any) => c.categoryName);

            if (newExcludedTopics.length > 0) {
                // Re-filter active categories
                const newActiveCategories = experienceCategories.filter(
                    (cat: any) => !newExcludedTopics.includes(cat.name)
                );

                // Check if all categories now excluded
                if (newActiveCategories.length === 0) {
                    log.info(LOG_CATEGORY, "[next-question] All categories excluded after 'I don't know' increment");
                    return NextResponse.json({
                        success: true,
                        allCategoriesExcluded: true,
                        question: null,
                        newFocusTopic: null,
                        isGibberish: false,
                        isClarificationRequest: false,
                        isDontKnow: isDontKnowForTopicSelection,
                        shouldIncrementRetry: false,
                        shouldMoveOn: false,
                    });
                }

                // Update activeCategories for topic selection below
                activeCategories = newActiveCategories;

                // Re-calculate countsForSelection with updated exclusions
                const activeCategoryNames = activeCategories.map((cat: any) => cat.name);
                countsForSelection = countsForSelection.filter((c: any) =>
                    activeCategoryNames.includes(c.categoryName)
                );
            }
        }

        // Partition: active (count < TARGET) vs inactive (count >= TARGET)
        const active = countsForSelection.filter((c: any) => c.count < TARGET);

        let newFocusTopic: string;
        if (active.length > 0) {
            // MODE 1: Contribution collection - prefer higher count, tie-break by higher strength
            // TODO: Investigate potential bug - array element access [0] without bounds check. If array is empty or becomes empty after sort, this will fail
            newFocusTopic = active.sort((a: any, b: any) =>
                b.count - a.count || b.avgStrength - a.avgStrength
            )[0].categoryName;
        } else {
            // MODE 2: Rebalance - pick weakest category (lowest avgStrength)
            // TODO: Investigate potential bug - array element access [0] without bounds check. If countsForSelection is empty, this will fail
            newFocusTopic = countsForSelection.sort((a: any, b: any) =>
                a.avgStrength - b.avgStrength
            )[0].categoryName;
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // OPENAI PROMPT: QUESTION GENERATION WITH CLASSIFICATION
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        const quickPrompt = buildClassificationPrompt({
            lastQuestion,
            lastAnswer,
            categoryList,
            newFocusTopic,
            clarificationRetryCount: retryCount,
            clarificationThreshold: CLARIFICATION_THRESHOLD,
            isGibberish,
        });

        const messages = [
            {
                role: "system" as const,
                content: companyName && jobTitle
                    ? `You are a technical interviewer at ${companyName} evaluating candidates for the ${jobTitle} position. Return valid JSON only.`
                    : "You are a technical interviewer. Return valid JSON only.",
            },
            {
                role: "user" as const,
                content: quickPrompt,
            },
        ];

        console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("→ OpenAI Request [next-question]");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("Model:", evaluationModel);
        console.log("\nSystem:", messages[0].content);
        console.log("\nUser Prompt:", messages[1].content);

        const startTime = Date.now();
        const completion = await openai.chat.completions.create({
            model: evaluationModel,
            messages,
            response_format: { type: "json_object" },
            temperature: 0.7, // More natural for question generation
            max_tokens: 150, // Keep questions short
        });
        const elapsed = Date.now() - startTime;

        const responseText = completion.choices[0]?.message?.content;
        console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("← OpenAI Response [next-question]");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`Latency: ${elapsed}ms`);
        // TODO: Investigate potential bug - JSON.parse called before validation of responseText. Can throw if response is invalid or empty
        console.log(JSON.stringify(JSON.parse(responseText || "{}"), null, 2));
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

        if (!responseText) {
            throw new Error("OpenAI returned empty response");
        }

        const result = JSON.parse(responseText) as ClassifiedQuestionResponse;

        // Validate response structure
        if (!result.detectedAnswerType || !result.question) {
            throw new Error("OpenAI response missing required fields");
        }

        // Derive classification flags from OpenAI's judgment (single source of truth)
        const answerType: AnswerType = result.detectedAnswerType;
        const isClarificationRequest = answerType === 'clarification_request';
        const isDontKnow = answerType === 'dont_know';
        const shouldIncrementRetry = shouldIncrementRetryCounter(answerType, retryCount, CLARIFICATION_THRESHOLD);
        const shouldMoveOn = shouldMoveToNextQuestion(answerType, retryCount, CLARIFICATION_THRESHOLD);

        log.info(LOG_CATEGORY, `[next-question] Classification: ${answerType}, Question generated in ${elapsed}ms`);

        return NextResponse.json({
            success: true,
            question: result.question,
            newFocusTopic,
            isGibberish,
            isClarificationRequest,
            isDontKnow,
            shouldIncrementRetry,
            shouldMoveOn,
            latencyMs: elapsed, // For monitoring
        });
    } catch (error) {
        log.error(LOG_CATEGORY, "[next-question] ❌ Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
