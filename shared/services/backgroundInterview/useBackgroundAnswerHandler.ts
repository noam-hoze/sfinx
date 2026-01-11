/**
 * useBackgroundAnswerHandler Hook
 * Handles answer submission: adds to chat store, runs control checks, evaluates gate, generates follow-up or completes.
 * Returns handler function and completion status.
 */

import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import OpenAI from "openai";
import { store, RootState } from "@/shared/state/store";
import { addMessage, setEvaluatingAnswer, setCurrentFocusTopic, setCurrentQuestionTarget } from "@/shared/state/slices/backgroundSlice";
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
      log.error("Failed to save message:", err);
    }
  };

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

        // Call evaluate-answer API (blocking) - wait for updated counts
        const backgroundState = store.getState().background;
        const currentQuestion = backgroundState.messages?.filter(m => m.speaker === "ai").slice(-1)[0]?.text || "";
        
        let categoryStats: Array<{categoryName: string; count: number; avgStrength: number}> = [];
        
        if (sessionId) {
          const experienceCategories = script?.experienceCategories || [];
          const evalTimestamp = new Date().toISOString();
          dispatch(setEvaluatingAnswer({ evaluating: true }));
          
          try {
            const evalResponse = await fetch(`/api/interviews/evaluate-answer`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sessionId,
                question: currentQuestion,
                answer,
                timestamp: evalTimestamp,
                experienceCategories,
              })
            });
            
            const evalData = await evalResponse.json();
            
            if (evalData.allEvaluations && onEvaluationReceived) {
              onEvaluationReceived({
                timestamp: evalTimestamp,
                question: currentQuestion,
                answer,
                evaluations: evalData.allEvaluations,
              });
            }
            
            // Use updated counts from evaluation response
            categoryStats = evalData.updatedCounts || [];
          } catch (err) {
            log.error("Failed to evaluate answer:", err);
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
          
          // Fetch current category confidence scores
          let categories: Array<{name: string; confidence: number}> = [];
          if (sessionId) {
            try {
              const contributionsRes = await fetch(`/api/interviews/session/${sessionId}/contributions`);
              if (contributionsRes.ok) {
                const { categoryStats } = await contributionsRes.json();
                categories = categoryStats.map((stat: any) => ({
                  name: stat.categoryName,
                  confidence: stat.confidence * 100
                }));
              }
            } catch (err) {
              log.error("Failed to fetch contributions:", err);
            }
          }
          
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
            // Generate follow-up question with category-aware guidance
            log.info("Generating follow-up question...");
            
            // Build category guidance using fresh data from evaluation
            const TARGET_CONTRIBUTIONS = 5;
            const experienceCategories = script?.experienceCategories || [];
            let categoryGuidance = "";
            
            // Build coverage map from fresh category stats
            const coverageInfo = experienceCategories.map((cat: any) => {
              const stats = categoryStats?.find((s: any) => s.categoryName === cat.name);
              return {
                name: cat.name,
                contributionsCount: stats?.count || 0,
                avgStrength: stats?.avgStrength || 0,
              };
            });
            
            const underSaturated = coverageInfo.filter((c: any) => c.contributionsCount < TARGET_CONTRIBUTIONS);
            const allSaturated = underSaturated.length === 0;
            
            // Get current focus topic
            let currentFocusTopicName = store.getState().background.currentFocusTopic;
            
            if (!currentFocusTopicName && coverageInfo.length > 0) {
              // Initial state: pick topic with HIGHEST contributions (after first answer)
              currentFocusTopicName = coverageInfo.sort((a: any, b: any) => b.contributionsCount - a.contributionsCount)[0].name;
              dispatch(setCurrentFocusTopic({ topicName: currentFocusTopicName }));
            }
            
            const currentTopicInfo = coverageInfo.find((c: any) => c.name === currentFocusTopicName);
            
            if (coverageInfo.length > 0) {
              const coverageList = coverageInfo.map((c: any) => 
                `- ${c.name}: ${c.contributionsCount} contribution${c.contributionsCount !== 1 ? 's' : ''} (avg: ${c.avgStrength}%)`
              ).join('\n');
              
              let focusGuidance = "";
              
              if (allSaturated) {
                // Phase 3: All topics >= 5, pick lowest score EACH round (don't persist)
                const lowestScoreTopic = coverageInfo.sort((a: any, b: any) => a.avgStrength - b.avgStrength)[0];
                focusGuidance = `All topics have strong coverage.\n\nFocus your next question on "${lowestScoreTopic.name}" - build more depth (${lowestScoreTopic.contributionsCount} contributions).`;
              } else if (currentTopicInfo && currentTopicInfo.contributionsCount < TARGET_CONTRIBUTIONS) {
                // Phase 1: Continue on current topic
                focusGuidance = `Focus your next question on "${currentTopicInfo.name}" - continue building evidence (${currentTopicInfo.contributionsCount}/${TARGET_CONTRIBUTIONS} contributions).`;
              } else if (currentTopicInfo && currentTopicInfo.contributionsCount >= TARGET_CONTRIBUTIONS) {
                // Phase 2: Current topic saturated, pivot to highest of those < 5
                const nextTopic = underSaturated.sort((a: any, b: any) => b.contributionsCount - a.contributionsCount)[0];
                focusGuidance = `"${currentTopicInfo.name}" has sufficient evidence (${currentTopicInfo.contributionsCount} contributions).\n\nFocus your next question on "${nextTopic.name}" - it needs more evidence (${nextTopic.contributionsCount}/${TARGET_CONTRIBUTIONS} contributions). Transition naturally to this new topic.`;
                dispatch(setCurrentFocusTopic({ topicName: nextTopic.name }));
              }
              
              categoryGuidance = `\n\nCATEGORY COVERAGE GUIDANCE:
Your goal is to gather evidence for all experience categories through natural conversation.

Current coverage:
${coverageList}

${focusGuidance}`;
            }
            
            log.info("Category guidance:", categoryGuidance);
            
            // Add last answer context to guidance
            let answerContext = "";
            if (isBlankAnswer) {
              const previousQuestion = currentQuestion || "the question";
              answerContext = `\n\nINSTRUCTION: The candidate didn't know the answer to: "${previousQuestion}"\n\n1. Acknowledge briefly that they're unsure (e.g., "I understand that's challenging")\n2. Generate a completely NEW question on a DIFFERENT angle or aspect\n3. Stay within the target category from the guidance above\n4. DO NOT repeat any question from the conversation history`;
              log.info("BLANK ANSWER DETECTED - sending special instruction");
            } else {
              answerContext = `\n\nCandidate's last answer: "${answer}"\nRespond contextually to what they said.`;
            }
            
            log.info("Answer context:", answerContext.substring(0, 150));
            
            const persona = buildOpenAIBackgroundPrompt(String(companyName), script?.experienceCategories) + categoryGuidance + answerContext;
            const historyMessages = buildControlContextMessages(CONTROL_CONTEXT_TURNS);
            
            const followUpRaw = await askViaChatCompletion(openaiClient, persona, historyMessages);

            if (followUpRaw) {
              log.info("Raw OpenAI response:", followUpRaw);
              try {
                // Parse JSON response
                const parsed = JSON.parse(followUpRaw);
                log.info("Parsed JSON:", parsed);
                const question = parsed.question || followUpRaw;
                const targetedCategory = parsed.targetedCategory || null;

                log.info("Extracted question:", question);
                log.info("Targeted category:", targetedCategory);

                dispatch(addMessage({ text: question, speaker: "ai" }));
                saveMessageToDb(question, "ai");

                if (targetedCategory) {
                  dispatch(setCurrentQuestionTarget({ question, category: targetedCategory }));
                }

                log.info("Follow-up question generated and dispatched");
              } catch (err) {
                // Fallback if not JSON
                log.error("JSON parse failed:", err);
                log.warn("Using raw text as fallback");
                dispatch(addMessage({ text: followUpRaw, speaker: "ai" }));
                saveMessageToDb(followUpRaw, "ai");
              }
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
    [dispatch, companyName, sessionId]
  );

  return { handleSubmit };
}
