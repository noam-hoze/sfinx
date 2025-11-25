/**
 * useBackgroundPreload Hook
 * Handles preloading: script fetch, demo user/session creation, first question generation, announcement TTS.
 * Stores preloaded data in Redux. Called during loading phase.
 */

import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import OpenAI from "openai";
import { RootState } from "@/shared/state/store";
import { interviewChatStore } from "@/shared/state/interviewChatStore";
import {
  setPreloadedData,
  setSessionId,
  setCompanyContext,
  setExpectedBackgroundQuestion,
  setPageLoading,
} from "@/shared/state/slices/interviewMachineSlice";
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
      onCodingTimeSet?: (minutes: number) => void,
      onBackgroundTimeSet?: (seconds: number) => void
    ) => {
      try {
        console.log("[preload] Starting preload sequence...");

        const parts = jobId.split("-");
        const companySlug = parts[0];
        const roleSlug = parts.slice(1).join("-");

        // Step 1: Create demo user + application
        console.log("[preload] Creating demo user...");
        const demoUserId = `demo-candidate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const demoUserResp = await fetch(`/api/users/demo?skip-auth=true`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: demoUserId, name: `Guest-${Date.now()}` }),
        });

        if (!demoUserResp.ok) throw new Error("Failed to create demo user");
        const demoData = await demoUserResp.json();
        const createdApplicationId = demoData.applicationId;

        // Step 2: Create interview session
        console.log("[preload] Creating interview session...");
        const session = await createInterviewSession({
          applicationId: createdApplicationId,
          companyId,
          userId: demoUserId,
          isDemoMode: true,
        });

        if (!session?.interviewSession?.id) throw new Error("Failed to create interview session");
        const sessId = session.interviewSession.id;

        // Step 3: Fetch interview script (with cache)
        const scriptCacheKey = `interview-script-${jobId}`;
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
        const persona = buildOpenAIBackgroundPrompt(companyNameFromScript);
        const instruction = `Ask exactly: "${String(scriptData.backgroundQuestion)}"`;
        const firstQuestion = await generateAssistantReply(openaiClient, persona, instruction);

        if (!firstQuestion) throw new Error("Failed to generate first question");

        // Store preloaded data in Redux
        dispatch(
          setPreloadedData({
            userId: demoUserId,
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

        if (scriptData.backgroundQuestion) {
          dispatch(setExpectedBackgroundQuestion({ question: String(scriptData.backgroundQuestion) }));
        }

        if (scriptData.codingQuestionTimeSeconds && onCodingTimeSet) {
          onCodingTimeSet(Math.round(scriptData.codingQuestionTimeSeconds / 60));
        }

        if (scriptData.backgroundQuestionTimeSeconds && onBackgroundTimeSet) {
          onBackgroundTimeSet(scriptData.backgroundQuestionTimeSeconds);
          const timeboxMs = scriptData.backgroundQuestionTimeSeconds * 1000;
          interviewChatStore.dispatch({
            type: "BG_GUARD_SET_TIMEBOX",
            payload: { timeboxMs },
          } as any);
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
