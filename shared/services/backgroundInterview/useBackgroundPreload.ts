/**
 * useBackgroundPreload Hook
 * Handles preloading: script fetch, demo user/session creation, first question generation, announcement TTS.
 * Stores preloaded data in Redux. Called during loading phase.
 */

import { useCallback } from "react";
import { useDispatch } from "react-redux";
import OpenAI from "openai";
import {
  setPreloadedData,
  setSessionId,
  setCompanyContext,
} from "@/shared/state/slices/interviewSlice";
import { setTimebox as setBackgroundTimebox } from "@/shared/state/slices/backgroundSlice";
import { setTimebox as setCodingTimebox } from "@/shared/state/slices/codingSlice";
import { buildOpenAIBackgroundPrompt } from "@/shared/prompts/openAIInterviewerPrompt";
import { generateAssistantReply } from "app/(features)/interview/components/chat/openAITextConversationHelpers";
import { createInterviewSession } from "app/(features)/interview/components/services/interviewSessionService";

/**
 * Execute background preload sequence: create user, session, fetch script, generate first question.
 * Dispatches preloaded data to Redux on success.
 */
export function useBackgroundPreload() {
  const dispatch = useDispatch();

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
        console.log("[preload] Starting preload sequence...");

        const parts = jobId.split("-");
        const companySlug = parts[0];
        const roleSlug = parts.slice(1).join("-");

        if (!sessionUserId) {
          throw new Error("Authentication required");
        }

        // Step 1: Create application for authenticated user
        console.log("[preload] Creating application for authenticated user...");
        const userId = sessionUserId;
        const appResp = await fetch(`/api/applications/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId, jobId }),
        });

        if (!appResp.ok) throw new Error("Failed to create application");
        const appData = await appResp.json();
        const createdApplicationId = appData.application.id;

        // Step 2: Create interview session
        console.log("[preload] Creating interview session...");
        const session = await createInterviewSession({
          applicationId: createdApplicationId,
          companyId,
          userId,
        });

        if (!session?.interviewSession?.id) throw new Error("Failed to create interview session");
        const sessId = session.interviewSession.id;

        // Step 3: Fetch interview script (with cache)
        const SCRIPT_CACHE_VERSION = 'v3'; // Increment to invalidate old caches
        const scriptCacheKey = `interview-script-${jobId}-${SCRIPT_CACHE_VERSION}`;
        let scriptData: any = null;

        try {
          const cached = localStorage.getItem(scriptCacheKey);
          if (cached) {
            scriptData = JSON.parse(cached);
            console.log("[preload] Script loaded from cache");
          }
        } catch (err) {
          console.warn("[preload] Failed to read script cache:", err);
        }

        if (!scriptData) {
          console.log("[preload] Fetching script from API...");
          const scriptResp = await fetch(`/api/interviews/script?company=${companySlug}&role=${roleSlug}`);
          if (!scriptResp.ok) throw new Error("Failed to load interview script");
          scriptData = await scriptResp.json();
          localStorage.setItem(scriptCacheKey, JSON.stringify(scriptData));
        }

        // Step 4: Generate first OpenAI question
        console.log("[preload] Generating first question...");
        const companyNameFromScript = scriptData.companyName || companySlug.charAt(0).toUpperCase() + companySlug.slice(1);
        const persona = buildOpenAIBackgroundPrompt(companyNameFromScript, scriptData.experienceCategories);
        const instruction = `Ask exactly: "${String(scriptData.backgroundQuestion)}"`;
        const firstQuestion = await generateAssistantReply(openaiClient, persona, instruction);

        if (!firstQuestion) throw new Error("Failed to generate first question");

        // Store preloaded data in Redux
        dispatch(
          setPreloadedData({
            userId,
            applicationId: createdApplicationId,
            script: scriptData,
            preloadedFirstQuestion: firstQuestion,
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

        if (scriptData.codingQuestionTimeSeconds) {
          dispatch(setCodingTimebox({ timeboxSeconds: scriptData.codingQuestionTimeSeconds }));
        }

        if (scriptData.backgroundQuestionTimeSeconds && onBackgroundTimeSet) {
          onBackgroundTimeSet(scriptData.backgroundQuestionTimeSeconds);
          const timeboxMs = scriptData.backgroundQuestionTimeSeconds * 1000;
          dispatch(setBackgroundTimebox({ timeboxMs }));
        }

        if (scriptData.experienceCategories && onExperienceCategoriesSet) {
          onExperienceCategoriesSet(scriptData.experienceCategories);
        }

        console.log("[preload] Preload complete - data stored in Redux");
        return { success: true, scriptData, firstQuestion, companyNameFromScript };
      } catch (error) {
        console.error("[preload] Preload failed:", error);
        throw error;
      }
    },
    [dispatch]
  );

  return { preload };
}
