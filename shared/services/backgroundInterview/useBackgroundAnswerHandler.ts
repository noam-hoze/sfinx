/**
 * useBackgroundAnswerHandler Hook
 * Handles answer submission: adds to chat store, runs control checks, evaluates gate, generates follow-up or completes.
 * Returns handler function and completion status.
 */

import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import OpenAI from "openai";
import { store, RootState } from "@/shared/state/store";
import { interviewChatStore } from "@/shared/state/interviewChatStore";
import { userFinal, aiFinal } from "@/shared/state/slices/interviewMachineSlice";
import {
  askViaChatCompletion,
  generateAssistantReply,
} from "app/(features)/interview/components/chat/openAITextConversationHelpers";
import { shouldTransition } from "@/shared/services/backgroundSessionGuard";
import { buildOpenAIBackgroundPrompt } from "@/shared/prompts/openAIInterviewerPrompt";
import { buildControlContextMessages, CONTROL_CONTEXT_TURNS } from "app/shared/services";
import { checkCategoryGate, type CategoryCoverageStats } from "./categoryGateCheck";

interface AnswerHandlerResult {
  gateReady: boolean;
  transitionReason?: string;
  shouldComplete: boolean;
}

/**
 * Handle answer submission: store, control check, gate evaluation, follow-up or completion.
 * Returns gate status and completion flag. Updates Redux/chat store. Logs all transitions.
 */
export function useBackgroundAnswerHandler(onEvaluationReceived?: (data: any) => void) {
  const dispatch = useDispatch();
  const companyName = useSelector((state: RootState) => state.interviewMachine.companyName);
  const sessionId = useSelector((state: RootState) => state.interviewMachine.sessionId);
  const userId = useSelector((state: RootState) => state.interviewMachine.userId);
  const script = useSelector((state: RootState) => state.interviewMachine.script);

  const saveMessageToDb = async (text: string, speaker: "user" | "ai" | "system") => {
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
      console.error("[answer-handler] Failed to save message:", err);
    }
  };

  const handleSubmit = useCallback(
    async (answer: string, openaiClient: OpenAI | null, candidateName: string): Promise<AnswerHandlerResult> => {
      if (!openaiClient || !companyName) {
        console.log("[answer-handler] Submit blocked - missing openaiClient or companyName");
        return { gateReady: false, shouldComplete: false };
      }

      console.log("[answer-handler] Processing answer:", answer.substring(0, 50) + "...");

      try {
        // Add to chat store
        interviewChatStore.dispatch({
          type: "ADD_MESSAGE",
          payload: { text: answer, speaker: "user" },
        } as any);
        
        // Save user answer to DB
        saveMessageToDb(answer, "user");

        // Call evaluate-answer API (non-blocking) - API will fetch categories from job
        const chatState = interviewChatStore.getState();
        const currentQuestion = chatState.messages?.filter(m => m.speaker === "ai").slice(-1)[0]?.text || "";
        
        if (sessionId) {
          const experienceCategories = script?.experienceCategories || [];
          const evalTimestamp = new Date().toISOString();
          fetch(`/api/interviews/evaluate-answer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId,
              question: currentQuestion,
              answer,
              timestamp: evalTimestamp,
              experienceCategories,
            })
          })
          .then(res => res.json())
          .then(data => {
            // Track useless answers based on evaluation (replaces old scorer BG_ACCUMULATE_CONTROL_RESULT logic)
            if (data.contributionsCount !== undefined) {
              if (data.contributionsCount === 0) {
                interviewChatStore.dispatch({
                  type: "BG_INCREMENT_USELESS_ANSWERS"
                });
              } else {
                interviewChatStore.dispatch({
                  type: "BG_RESET_USELESS_ANSWERS"
                });
              }
            }
            
            if (data.allEvaluations && onEvaluationReceived) {
              onEvaluationReceived({
                timestamp: evalTimestamp,
                question: currentQuestion,
                answer,
                evaluations: data.allEvaluations,
              });
            }
          })
          .catch(err => console.error("[answer-handler] Failed to evaluate answer:", err));
        }

        // Transition machine state
        dispatch(userFinal());
        const ms = store.getState().interviewMachine;
        console.log("[answer-handler] Machine state after userFinal:", ms.state);

        if (ms.state === "background_answered_by_user") {
          // Check gate using category contributions
          console.log("[answer-handler] Checking category gate...");
          
          let gateReady = false;
          let gateReason = "";
          
          if (sessionId) {
            try {
              const contributionsRes = await fetch(`/api/interviews/session/${sessionId}/contributions`);
              if (contributionsRes.ok) {
                const { categoryStats } = await contributionsRes.json();
                const experienceCategories = script?.experienceCategories || [];
                
                const gateResult = checkCategoryGate(categoryStats as CategoryCoverageStats[], experienceCategories);
                gateReady = gateResult.gateReady;
                gateReason = gateResult.reason || "";
                
                console.log("[answer-handler] Category gate check:", { gateReady, gateReason, categoryStats });
              }
            } catch (err) {
              console.error("[answer-handler] Failed to check category gate:", err);
            }
          }

          const chatState = interviewChatStore.getState();
          const consecutiveUselessAnswers = chatState.background.consecutiveUselessAnswers;
          const timeboxMs = chatState.background.timeboxMs;
          const startedAtMs = chatState.background.startedAtMs;
          
          const transitionReason = shouldTransition(
            {
              startedAtMs,
              consecutiveUselessAnswers: consecutiveUselessAnswers ?? 0,
              timeboxMs,
            },
            { gateReady, timeboxMs }
          );

          console.log("[answer-handler] Gate check:", { gateReady, transitionReason, gateReason });

          if (transitionReason) {
            // Gate satisfied - generate closing response
            console.log(`[answer-handler] Gate satisfied (${transitionReason})`);
            console.log(`[answer-handler] Category gate reason: ${gateReason}`);
            const persona = buildOpenAIBackgroundPrompt(String(companyName), script?.experienceCategories);
            const firstName = candidateName.split(" ")[0] || "Candidate";
            const closingInstruction = `Say exactly: "Thank you so much ${firstName}, the next steps will be shared with you shortly."`;

            try {
              const finalResponse = await generateAssistantReply(openaiClient, persona, closingInstruction);
              const responseText = finalResponse || "";
              
              interviewChatStore.dispatch({
                type: "ADD_MESSAGE",
                payload: { text: responseText, speaker: "ai" },
              } as any);
              saveMessageToDb(responseText, "ai");
              
              const systemMsg = `[SYSTEM: Background interview completed (${gateReason}), transitioning to coding stage]`;
              interviewChatStore.dispatch({
                type: "ADD_MESSAGE",
                payload: {
                  text: systemMsg,
                  speaker: "system" as any,
                },
              } as any);
              // Don't save system message to DB to keep transcript clean
              
              console.log("[answer-handler] Final response generated");
            } catch (err) {
              console.error("[answer-handler] Failed to generate final response:", err);
            }

            return { gateReady: true, transitionReason, shouldComplete: true };
          } else {
            // Generate follow-up question with category-aware guidance
            console.log("[answer-handler] Generating follow-up question...");
            
            // Fetch current category coverage
            let categoryGuidance = "";
            if (sessionId) {
              try {
                const contributionsRes = await fetch(`/api/interviews/session/${sessionId}/contributions`);
                if (contributionsRes.ok) {
                  const { categoryStats } = await contributionsRes.json();
                  const experienceCategories = script?.experienceCategories || [];
                  
                  // Build guidance for OpenAI
                  const coverageInfo = experienceCategories.map((cat: any) => {
                    const stats = categoryStats?.find((s: any) => s.categoryName === cat.name);
                    return {
                      name: cat.name,
                      description: cat.description,
                      example: cat.example,
                      contributionsCount: stats?.count || 0,
                      avgStrength: stats?.avgStrength || 0,
                    };
                  }).sort((a: any, b: any) => a.contributionsCount - b.contributionsCount);
                  
                  if (coverageInfo.length > 0) {
                    categoryGuidance = `\n\nCATEGORY COVERAGE GUIDANCE:
Your PRIMARY goal is to gather evidence for all experience categories, especially those with fewer contributions.

Current coverage:
${coverageInfo.map((c: any) => `- ${c.name}: ${c.contributionsCount} contribution${c.contributionsCount !== 1 ? 's' : ''} (avg: ${c.avgStrength}%)${c.contributionsCount === 0 ? ' ⚠️ NEEDS COVERAGE' : ''}`).join('\n')}

PRIORITY: Ask about "${coverageInfo[0].name}" next.
Example: ${coverageInfo[0].example}

Your question should naturally probe for specific examples and details that demonstrate this category.`;
                  }
                }
              } catch (err) {
                console.error("[answer-handler] Failed to fetch category coverage:", err);
              }
            }
            
            const persona = buildOpenAIBackgroundPrompt(String(companyName), script?.experienceCategories) + categoryGuidance;
            const historyMessages = buildControlContextMessages(CONTROL_CONTEXT_TURNS);
            const followUp = await askViaChatCompletion(openaiClient, persona, historyMessages);

            if (followUp) {
              interviewChatStore.dispatch({
                type: "ADD_MESSAGE",
                payload: { text: followUp, speaker: "ai" },
              } as any);
              saveMessageToDb(followUp, "ai");

              dispatch(aiFinal({ text: followUp }));
              console.log("[answer-handler] Follow-up question generated and dispatched");
            }

            return { gateReady: false, shouldComplete: false };
          }
        }

        return { gateReady: false, shouldComplete: false };
      } catch (error) {
        console.error("[answer-handler] Error processing answer:", error);
        throw error;
      }
    },
    [dispatch, companyName, sessionId]
  );

  return { handleSubmit };
}
