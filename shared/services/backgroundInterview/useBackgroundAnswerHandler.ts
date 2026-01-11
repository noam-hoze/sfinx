/**
 * useBackgroundAnswerHandler Hook
 * Handles answer submission: adds to chat store, runs control checks, evaluates gate, generates follow-up or completes.
 * Returns handler function and completion status.
 */

import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import OpenAI from "openai";
import { store, RootState } from "@/shared/state/store";
import { addMessage, setEvaluatingAnswer, setCurrentFocusTopic, setCurrentQuestionTarget, updateCategoryStats } from "@/shared/state/slices/backgroundSlice";
import {
  askViaChatCompletion,
  generateAssistantReply,
} from "app/(features)/interview/components/chat/openAITextConversationHelpers";
import { shouldTransition } from "@/shared/services/backgroundSessionGuard";
import { buildOpenAIBackgroundPrompt } from "@/shared/prompts/openAIInterviewerPrompt";
import { buildControlContextMessages, CONTROL_CONTEXT_TURNS } from "app/shared/services";
import { log } from "app/shared/services/logger";

interface AnswerHandlerResult {
  transitionReason?: string;
  shouldComplete: boolean;
}

/**
 * Handle answer submission: store, control check, gate evaluation, follow-up or completion.
 * Returns gate status and completion flag. Updates Redux/chat store. Logs all transitions.
 */
export function useBackgroundAnswerHandler(onEvaluationReceived?: (data: any) => void) {
  const dispatch = useDispatch();
  const companyName = useSelector((state: RootState) => state.interview.companyName);
  const sessionId = useSelector((state: RootState) => state.interview.sessionId);
  const userId = useSelector((state: RootState) => state.interview.userId);
  const script = useSelector((state: RootState) => state.interview.script);
  const categoryStats = useSelector((state: RootState) => state.background.categoryStats);

  const saveMessageToDb = useCallback(async (text: string, speaker: "user" | "ai" | "system") => {
    if (!sessionId) return;
    try {
      // Use skip-auth=true since we might be in demo mode or auth might be tricky in background
      // The API endpoint handles validation
      await fetch(`/api/interviews/session/${sessionId}/messages?skip-auth=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId, // Required for skip-auth
          messages: [{
            text,
            speaker,
            stage: "background",
            timestamp: new Date().toISOString()
          }]
        })
      });
    } catch (err) {
      log.error("Failed to save message:", err);
    }
  }, [sessionId, userId]);

  const handleSubmit = useCallback(
    async (answer: string, openaiClient: OpenAI | null, candidateName: string): Promise<AnswerHandlerResult> => {
      if (!openaiClient || !companyName) {
        log.info("Submit blocked - missing openaiClient or companyName");
        return { shouldComplete: false };
      }

      try {
        // Detect blank answers
        const isBlankAnswer = answer.trim().length === 0;
        
        // Add to chat store
        dispatch(addMessage({ text: answer, speaker: "user" }));
        
        // Save user answer to DB
        saveMessageToDb(answer, "user");

        // PHASE 2: Dual-call flow - fast endpoint for scores/question, async full evaluation
        const backgroundState = store.getState().background;
        const currentQuestion = backgroundState.messages?.filter(m => m.speaker === "ai").slice(-1)[0]?.text || "";
        
        let updatedCategoryStats = categoryStats;
        let nextQuestionText = "";
        
        if (sessionId) {
          const experienceCategories = script?.experienceCategories || [];
          const evalTimestamp = new Date().toISOString();
          dispatch(setEvaluatingAnswer({ evaluating: true }));
          
          try {
            // Call 1: Fast endpoint for scores + next question (blocking, ~1-2s)
            const conversationHistory = backgroundState.messages.slice(-4);
            const currentFocusTopic = backgroundState.currentFocusTopic;
            
            const fastResponse = await fetch(`/api/interviews/evaluate-answer-fast`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                question: currentQuestion,
                answer,
                experienceCategories,
                currentCounts: categoryStats,
                currentFocusTopic,
                conversationHistory,
              })
            });
            
            const fastData = await fastResponse.json();
            
            // Use fast results immediately
            if (fastData.updatedCounts) {
              updatedCategoryStats = fastData.updatedCounts;
              dispatch(updateCategoryStats({ stats: fastData.updatedCounts }));
            }
            
            // Update focus topic if changed
            if (fastData.newFocusTopic) {
              dispatch(setCurrentFocusTopic({ topicName: fastData.newFocusTopic }));
            }
            
            nextQuestionText = fastData.nextQuestion || "";
            
            // Set question target for debug panel
            if (nextQuestionText && fastData.targetedCategory) {
              dispatch(setCurrentQuestionTarget({ question: nextQuestionText, category: fastData.targetedCategory }));
            }
            
            // Call 2: Full evaluation async (non-blocking, for reasoning/captions/DB)
            fetch(`/api/interviews/evaluate-answer`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sessionId,
                question: currentQuestion,
                answer,
                timestamp: evalTimestamp,
                experienceCategories,
                currentCounts: categoryStats,
              })
            }).then(async (fullResponse) => {
              const fullData = await fullResponse.json();
              log.info("[async] Full evaluation complete");
              
              if (fullData.allEvaluations && onEvaluationReceived) {
                onEvaluationReceived({
                  timestamp: evalTimestamp,
                  question: currentQuestion,
                  answer,
                  evaluations: fullData.allEvaluations,
                });
              }
            }).catch((err) => {
              log.error("[async] Full evaluation failed:", err);
            });
            
          } catch (err) {
            log.error("Failed fast evaluation:", err);
          } finally {
            dispatch(setEvaluatingAnswer({ evaluating: false }));
          }
        }

        // Transition machine state
        const ms = store.getState().interview;
        log.info("Interview stage:", ms.stage);

        if (ms.stage === "background") {
          const backgroundState = store.getState().background;
          const timeboxMs = backgroundState.timeboxMs;
          const startedAtMs = backgroundState.startedAtMs;
          
          // Calculate confidence from updated counts (no DB fetch needed)
          const TARGET_CONTRIBUTIONS = 5;
          const categories = updatedCategoryStats.map((stat: any) => ({
            name: stat.categoryName,
            confidence: Math.min(100, (stat.count / TARGET_CONTRIBUTIONS) * 100)
          }));
          
          const transitionReason = shouldTransition(
            { startedAtMs, timeboxMs },
            { timeboxMs, categories }
          );

          log.info("Time gate check:", { transitionReason, categories });

          if (transitionReason) {
            // Time limit reached - generate closing response
            log.info(`Time limit reached (${transitionReason})`);
            const persona = buildOpenAIBackgroundPrompt(String(companyName), script?.experienceCategories);
            const firstName = candidateName.split(" ")[0] || "Candidate";
            const closingInstruction = `Say exactly: "Thank you so much ${firstName}, the next steps will be shared with you shortly."`;

            try {
              const finalResponse = await generateAssistantReply(openaiClient, persona, closingInstruction);
              const responseText = finalResponse || "";
              
              dispatch(addMessage({ text: responseText, speaker: "ai" }));
              saveMessageToDb(responseText, "ai");
              
              const systemMsg = transitionReason === "all_topics_complete" 
                ? `[SYSTEM: All topics reached 100% confidence, transitioning to coding stage]`
                : `[SYSTEM: Background interview time limit reached, transitioning to coding stage]`;
              dispatch(addMessage({ text: systemMsg, speaker: "system" as any }));
              // Don't save system message to DB to keep transcript clean
              
              log.info("Final response generated");
            } catch (err) {
              log.error("Failed to generate final response:", err);
            }

            return { transitionReason, shouldComplete: true };
          } else {
            // PHASE 2: Use next question from fast API (no separate generation needed)
            log.info("Using next question from fast API");
            
            if (nextQuestionText) {
              dispatch(addMessage({ text: nextQuestionText, speaker: "ai" }));
              saveMessageToDb(nextQuestionText, "ai");
              log.info("Next question displayed");
            }

            return { shouldComplete: false };
          }
        }

        return { shouldComplete: false };
      } catch (error) {
        log.error("Error processing answer:", error);
        throw error;
      }
    },
    [dispatch, companyName, sessionId, userId, script, categoryStats, onEvaluationReceived, saveMessageToDb]
  );

  return { handleSubmit };
}
