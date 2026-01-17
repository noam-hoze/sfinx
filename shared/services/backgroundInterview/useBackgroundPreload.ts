/**
 * useBackgroundPreload Hook
 * Handles preloading: script fetch, demo user/session creation, first question generation, announcement TTS.
 * Stores preloaded data in Redux. Called during loading phase.
 */

import { useCallback } from "react";
import { useDispatch } from "react-redux";
import OpenAI from "openai";
import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";
import {
  setPreloadedData,
  setSessionId,
  setCompanyContext,
} from "@/shared/state/slices/interviewSlice";
import { setTimebox as setBackgroundTimebox, initializeCategoryStats } from "@/shared/state/slices/backgroundSlice";
import { setTimebox as setCodingTimebox } from "@/shared/state/slices/codingSlice";
import { generateAssistantReply } from "app/(features)/interview/components/chat/openAITextConversationHelpers";
import { createInterviewSession } from "app/(features)/interview/components/services/interviewSessionService";

const LOG_CATEGORY = LOG_CATEGORIES.BACKGROUND_INTERVIEW;

/**
 * Execute background preload sequence: create user, session, fetch script, generate first question.
 * Dispatches preloaded data to Redux on success.
 */
export function useBackgroundPreload() {
  const dispatch = useDispatch();

  /**
   * Require a non-empty string.
   */
  const requireNonEmptyString = (value: unknown, label: string): string => {
    if (typeof value !== "string" || value.trim().length === 0) {
      log.error(LOG_CATEGORY, `[preload] Missing ${label}`);
      throw new Error(`${label} is required`);
    }
    return value;
  };

  /**
   * Parse first-question JSON and validate fields.
   */
  const parseFirstQuestion = (raw: string): { question: string; evaluationIntent: string } => {
    const parsed = JSON.parse(raw);
    return {
      question: requireNonEmptyString(parsed?.question, "first question"),
      evaluationIntent: requireNonEmptyString(parsed?.evaluationIntent, "evaluation intent"),
    };
  };

  const preload = useCallback(
    async (
      jobId: string,
      companyId: string,
      openaiClient: OpenAI,
      sessionUserId?: string | null,
      onBackgroundTimeSet?: (seconds: number) => void,
      onExperienceCategoriesSet?: (categories: Array<{name: string; description: string; weight: number; example?: string}>) => void
    ) => {
      try {
        log.info(LOG_CATEGORY, "[preload] Starting preload sequence...");

        const parts = jobId.split("-");
        const companySlug = requireNonEmptyString(parts[0], "company slug");
        const roleSlug = requireNonEmptyString(parts.slice(1).join("-"), "role slug");

        if (!sessionUserId) {
          throw new Error("Authentication required");
        }

        // Step 1: Create application for authenticated user
        log.info(LOG_CATEGORY, "[preload] Creating application for authenticated user...");
        const userId = sessionUserId;
        const appResp = await fetch(`/api/applications/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId, jobId }),
        });

        if (!appResp.ok) throw new Error("Failed to create application");
        const appData = await appResp.json();
        const createdApplicationId = requireNonEmptyString(appData?.application?.id, "applicationId");

        // Step 2: Create interview session
        log.info(LOG_CATEGORY, "[preload] Creating interview session...");
        const session = await createInterviewSession({
          applicationId: createdApplicationId,
          companyId,
          userId,
        });

        const sessId = requireNonEmptyString(session?.interviewSession?.id, "interview session id");

        // Step 3: Fetch interview script (with cache)
        const SCRIPT_CACHE_VERSION = 'v8'; // Increment to invalidate old caches
        const scriptCacheKey = `interview-script-${jobId}-${SCRIPT_CACHE_VERSION}`;
        let scriptData: any = null;

        try {
          const cached = localStorage.getItem(scriptCacheKey);
          if (cached) {
            scriptData = JSON.parse(cached);
            log.info(LOG_CATEGORY, "[preload] Script loaded from cache");
          }
        } catch (err) {
          log.warn(LOG_CATEGORY, "[preload] Failed to read script cache:", err);
        }

        if (!scriptData) {
          log.info(LOG_CATEGORY, "[preload] Fetching script from API...");
          const scriptResp = await fetch(`/api/interviews/script?company=${companySlug}&role=${roleSlug}`);
          if (!scriptResp.ok) throw new Error("Failed to load interview script");
          scriptData = await scriptResp.json();
          localStorage.setItem(scriptCacheKey, JSON.stringify(scriptData));
        }

        // Step 4: Generate first OpenAI question with intent
        log.info(LOG_CATEGORY, "[preload] Generating first question...");
        const companyNameFromScript = requireNonEmptyString(scriptData?.companyName, "companyName");
        const instruction = `Ask exactly: "${String(scriptData.backgroundQuestion)}"

Also provide an evaluation intent - one natural, calm sentence describing the lens or perspective you are listening through for this answer.

The sentence must NOT restate or paraphrase the question.

Focus on HOW you are listening, not WHAT is being asked.

Return JSON with format: {"question": "...", "evaluationIntent": "..."}`;
        
        const firstQuestionRaw = await generateAssistantReply(
          openaiClient, 
          "You are a technical interviewer. Return valid JSON only.",
          instruction
        );

        const firstQuestionRawText = requireNonEmptyString(firstQuestionRaw, "firstQuestionRaw");

        // Parse JSON response to extract question and intent
        let parsedQuestion: { question: string; evaluationIntent: string };
        try {
          parsedQuestion = parseFirstQuestion(firstQuestionRawText);
        } catch (err) {
          log.error(LOG_CATEGORY, "[preload] Failed to parse first question JSON", err);
          throw err;
        }

        const { question: firstQuestion, evaluationIntent: firstIntent } = parsedQuestion;
        dispatch(
          setPreloadedData({
            userId,
            applicationId: createdApplicationId,
            script: scriptData,
            preloadedFirstQuestion: firstQuestion,
            preloadedFirstIntent: firstIntent,
          })
        );

        dispatch(setSessionId({ sessionId: sessId }));
        dispatch(
          setCompanyContext({
            companyName: companyNameFromScript,
            companySlug,
            roleSlug,
          })
        );

        if (typeof scriptData.codingQuestionTimeSeconds === "number") {
          dispatch(setCodingTimebox({ timeboxSeconds: scriptData.codingQuestionTimeSeconds }));
        }

        if (typeof scriptData.backgroundQuestionTimeSeconds === "number" && onBackgroundTimeSet) {
          onBackgroundTimeSet(scriptData.backgroundQuestionTimeSeconds);
          const timeboxMs = scriptData.backgroundQuestionTimeSeconds * 1000;
          dispatch(setBackgroundTimebox({ timeboxMs }));
        }

        if (Array.isArray(scriptData.experienceCategories) && onExperienceCategoriesSet) {
          onExperienceCategoriesSet(scriptData.experienceCategories);
          // Initialize category stats in Redux store
          const categoryNames = scriptData.experienceCategories.map((c: any) =>
            requireNonEmptyString(c?.name, "experience category name")
          );
          dispatch(initializeCategoryStats({ categories: categoryNames }));
        }

        log.info(LOG_CATEGORY, "[preload] Preload complete - data stored in Redux");
        return { success: true, scriptData, firstQuestion, companyNameFromScript };
      } catch (error) {
        log.error(LOG_CATEGORY, "[preload] Preload failed:", error);
        throw error;
      }
    },
    [dispatch]
  );

  return { preload };
}
