/**
 * useBackgroundPreload Hook
 * Handles preloading: script fetch, DB record creation (or warmup activation),
 * first question generation, announcement TTS.
 * Stores preloaded data in Redux. Called during loading phase.
 *
 * Optimized: Runs three parallel tracks:
 *   Track A (DB): Activate warmup OR create application + session
 *   Track B (Content): Fetch script (likely cached) → generate first question
 *   Track C (Audio): Generate announcement TTS (with caching)
 */

import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";
import {
  setPreloadedData,
  setSessionId,
  setCompanyContext,
} from "@/shared/state/slices/interviewSlice";
import { setTimebox as setBackgroundTimebox, initializeCategoryStats, setCurrentFocusTopic } from "@/shared/state/slices/backgroundSlice";
import { setTimebox as setCodingTimebox } from "@/shared/state/slices/codingSlice";
import { generateAssistantReply } from "app/(features)/interview/components/chat/openAITextConversationHelpers";
import { createInterviewSession } from "app/(features)/interview/components/services/interviewSessionService";

const LOG_CATEGORY = LOG_CATEGORIES.BACKGROUND_INTERVIEW;

interface WarmupData {
  applicationId: string;
  sessionId: string;
}

/**
 * Execute background preload sequence with parallel tracks.
 * Dispatches preloaded data to Redux on success.
 */
export function useBackgroundPreload() {
  const dispatch = useDispatch();

  const preload = useCallback(
    async (
      jobId: string,
      companyId: string,
      sessionUserId?: string | null,
      warmupData?: WarmupData | null,
      onBackgroundTimeSet?: (seconds: number) => void,
      onExperienceCategoriesSet?: (categories: Array<{name: string; description: string; weight: number; example?: string}>) => void
    ) => {
      try {
        log.info(LOG_CATEGORY, "[preload] Starting parallel preload sequence...", {
          hasWarmup: !!warmupData,
        });

        if (!sessionUserId) {
          throw new Error("Authentication required");
        }

        const userId = sessionUserId;

        // ── Track A (DB): Activate warmup or create records ──
        const trackA = async (): Promise<{ applicationId: string; sessionId: string }> => {
          if (warmupData) {
            // Activate pre-created shell with real job data
            log.info(LOG_CATEGORY, "[preload:trackA] Activating warmup shell...");
            const resp = await fetch("/api/interviews/warmup/activate", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                applicationId: warmupData.applicationId,
                companyId,
                jobId,
              }),
            });

            if (resp.ok) {
              const data = await resp.json();
              const appId = data.application?.id || warmupData.applicationId;
              const sessId = data.sessionId || warmupData.sessionId;
              log.info(LOG_CATEGORY, "[preload:trackA] Warmup activated:", { appId, sessId, reused: data.reused });
              return { applicationId: appId, sessionId: sessId };
            }

            // Warmup activation failed — fall through to legacy path
            log.warn(LOG_CATEGORY, "[preload:trackA] Warmup activation failed, falling back to legacy creation");
          }

          // Legacy path: Create application + session sequentially
          log.info(LOG_CATEGORY, "[preload:trackA] Creating application...");
          const appResp = await fetch(`/api/applications/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companyId, jobId }),
          });

          if (!appResp.ok) throw new Error("Failed to create application");
          const appData = await appResp.json();
          const createdApplicationId = appData.application.id;

          log.info(LOG_CATEGORY, "[preload:trackA] Creating interview session...");
          const session = await createInterviewSession({
            applicationId: createdApplicationId,
            companyId,
            userId,
          });

          if (!session?.interviewSession?.id) throw new Error("Failed to create interview session");
          return { applicationId: createdApplicationId, sessionId: session.interviewSession.id };
        };

        // ── Track B (Content): Fetch script + generate first question ──
        const trackB = async (): Promise<{
          scriptData: any;
          firstQuestion: string;
          firstIntent: string;
          companyNameFromScript: string;
          jobTitleFromScript: string;
        }> => {
          // Fetch script (likely from localStorage cache)
          const SCRIPT_CACHE_VERSION = 'v8';
          const scriptCacheKey = `interview-script-${jobId}-${SCRIPT_CACHE_VERSION}`;
          let scriptData: any = null;

          try {
            const cached = localStorage.getItem(scriptCacheKey);
            if (cached) {
              scriptData = JSON.parse(cached);
              log.info(LOG_CATEGORY, "[preload:trackB] Script loaded from cache");
            }
          } catch (err) {
            console.warn("[preload:trackB] Failed to read script cache:", err);
          }

          if (!scriptData) {
            log.info(LOG_CATEGORY, "[preload:trackB] Fetching script from API...");
            const params = new URLSearchParams({ jobId });
            if (companyId) {
              params.set("companyId", companyId);
            }
            const scriptResp = await fetch(`/api/interviews/script?${params.toString()}`);
            if (!scriptResp.ok) {
              const detail = (await scriptResp.text().catch(() => "")) || scriptResp.statusText;
              throw new Error(`Failed to load interview script: ${detail}`);
            }
            scriptData = await scriptResp.json();
            try {
              localStorage.setItem(scriptCacheKey, JSON.stringify(scriptData));
            } catch {
              // localStorage full — ignore
            }
          }

          // Generate first question via OpenAI
          log.info(LOG_CATEGORY, "[preload:trackB] Generating first question...");
          const companyNameFromScript = scriptData.companyName || "the company";
          const jobTitleFromScript = scriptData.jobTitle || "this role";
          const instruction = `Ask exactly: "${String(scriptData.backgroundQuestion)}"

Also provide an evaluation intent - one natural, calm sentence describing the lens or perspective you are listening through for this answer.

The sentence must NOT restate or paraphrase the question.

Focus on HOW you are listening, not WHAT is being asked.

Return JSON with format: {"question": "...", "evaluationIntent": "..."}`;

          const firstQuestionRaw = await generateAssistantReply(
            "You are a technical interviewer. Return valid JSON only.",
            instruction
          );

          if (!firstQuestionRaw) throw new Error("Failed to generate first question");

          let firstQuestion = firstQuestionRaw;
          let firstIntent = "";
          try {
            const parsed = JSON.parse(firstQuestionRaw);
            firstQuestion = parsed.question || firstQuestionRaw;
            firstIntent = parsed.evaluationIntent || "";
          } catch {
            console.warn("[preload:trackB] Failed to parse JSON, using raw response");
          }

          return {
            scriptData,
            firstQuestion,
            firstIntent,
            companyNameFromScript,
            jobTitleFromScript,
          };
        };

        // ── Run tracks in parallel ──
        const [dbResult, contentResult] = await Promise.all([
          trackA(),
          trackB(),
        ]);

        const { applicationId: createdApplicationId, sessionId: sessId } = dbResult;
        const {
          scriptData,
          firstQuestion,
          firstIntent,
          companyNameFromScript,
          jobTitleFromScript,
        } = contentResult;

        // ── Dispatch all results to Redux ──
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
            companyId,
            jobId,
            jobTitle: jobTitleFromScript,
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
          const categoryNames = scriptData.experienceCategories.map((c: any) => c.name);
          dispatch(initializeCategoryStats({ categories: categoryNames }));

          if (scriptData.backgroundQuestionCategory) {
            dispatch(setCurrentFocusTopic({ topicName: scriptData.backgroundQuestionCategory }));
            log.info(LOG_CATEGORY, `[preload] Set first question category from DB: ${scriptData.backgroundQuestionCategory}`);
          } else if (categoryNames.length > 0) {
            dispatch(setCurrentFocusTopic({ topicName: categoryNames[0] }));
            log.info(LOG_CATEGORY, `[preload] No DB category, using first: ${categoryNames[0]}`);
          }
        }

        log.info(LOG_CATEGORY, "[preload] Parallel preload complete - data stored in Redux");
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
