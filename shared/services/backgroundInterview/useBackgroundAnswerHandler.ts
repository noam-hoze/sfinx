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
  runBackgroundControl,
  generateAssistantReply,
} from "app/(features)/interview/components/chat/openAITextConversationHelpers";
import { stopCheck } from "@/shared/services/weightedMean/scorer";
import { shouldTransition } from "@/shared/services/backgroundSessionGuard";
import { buildOpenAIBackgroundPrompt } from "@/shared/prompts/openAIInterviewerPrompt";
import { buildControlContextMessages, CONTROL_CONTEXT_TURNS } from "app/shared/services";

interface AnswerHandlerResult {
  gateReady: boolean;
  transitionReason?: string;
  shouldComplete: boolean;
}

/**
 * Handle answer submission: store, control check, gate evaluation, follow-up or completion.
 * Returns gate status and completion flag. Updates Redux/chat store. Logs all transitions.
 */
export function useBackgroundAnswerHandler() {
  const dispatch = useDispatch();
  const companyName = useSelector((state: RootState) => state.interviewMachine.companyName);
  const sessionId = useSelector((state: RootState) => state.interviewMachine.sessionId);
  const userId = useSelector((state: RootState) => state.interviewMachine.userId);

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

        // Transition machine state
        dispatch(userFinal());
        const ms = store.getState().interviewMachine;
        console.log("[answer-handler] Machine state after userFinal:", ms.state);

        if (ms.state === "background_answered_by_user") {
          // Run control checks
          console.log("[answer-handler] Running control checks...");
          await runBackgroundControl(openaiClient);

          // Check gate
          const chatState = interviewChatStore.getState();
          const scorer = chatState.background?.scorer;
          const coverage = chatState.background?.coverage;
          const consecutiveUselessAnswers = chatState.background.consecutiveUselessAnswers;
          const timeboxMs = chatState.background.timeboxMs;
          const startedAtMs = chatState.background.startedAtMs;
          const gateReady = !!(scorer && coverage && stopCheck(scorer, coverage));
          const transitionReason = shouldTransition(
            {
              startedAtMs,
              consecutiveUselessAnswers: consecutiveUselessAnswers ?? 0,
              timeboxMs,
            },
            { gateReady, timeboxMs }
          );

          console.log("[answer-handler] Gate check:", { gateReady, transitionReason });

          if (transitionReason) {
            // Gate satisfied - generate closing response
            console.log(`[answer-handler] Gate satisfied (${transitionReason})`);
            const persona = buildOpenAIBackgroundPrompt(String(companyName));
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
              
              const systemMsg = "[SYSTEM: Background interview completed, transitioning to coding stage]";
              interviewChatStore.dispatch({
                type: "ADD_MESSAGE",
                payload: {
                  text: systemMsg,
                  speaker: "system" as any,
                },
              } as any);
              // Don't save system message to DB to keep transcript clean? Or save it?
              // Let's skip saving system message for now as it's internal state
              
              console.log("[answer-handler] Final response generated");
            } catch (err) {
              console.error("[answer-handler] Failed to generate final response:", err);
            }

            return { gateReady: true, transitionReason, shouldComplete: true };
          } else {
            // Generate follow-up question
            console.log("[answer-handler] Generating follow-up question...");
            const persona = buildOpenAIBackgroundPrompt(String(companyName));
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
