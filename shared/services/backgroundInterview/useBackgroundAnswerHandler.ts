/**
 * useBackgroundAnswerHandler Hook
 * Handles answer submission: adds to chat store, runs control checks, evaluates gate, generates follow-up or completes.
 * Returns handler function and completion status.
 */

import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { store, RootState } from "@/shared/state/store";
import { addMessage, setEvaluatingAnswer, setCurrentFocusTopic, setCurrentQuestionTarget, updateCategoryStats, forceTimeExpiry, incrementQuestionSequence, incrementClarificationRetry } from "@/shared/state/slices/backgroundSlice";
import {
  askViaChatCompletion,
  generateAssistantReply,
} from "app/(features)/interview/components/chat/openAITextConversationHelpers";
import { shouldTransition } from "@/shared/services/backgroundSessionGuard";
import { buildOpenAIBackgroundPrompt } from "@/shared/prompts/openAIInterviewerPrompt";
import { buildControlContextMessages, CONTROL_CONTEXT_TURNS } from "app/shared/services";
import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.BACKGROUND_INTERVIEW;

interface AnswerHandlerResult {
  transitionReason?: string;
  shouldComplete: boolean;
}

/**
 * Handle answer submission: store, control check, gate evaluation, follow-up or completion.
 * Returns gate status and completion flag. Updates Redux/chat store. Logs all transitions.
 */
export function useBackgroundAnswerHandler(
  onEvaluationReceived?: (data: any) => void,
  onIntentReceived?: (intent: string) => void
) {
  const dispatch = useDispatch();
  const companyName = useSelector((state: RootState) => state.interview.companyName);
  const sessionId = useSelector((state: RootState) => state.interview.sessionId);
  const userId = useSelector((state: RootState) => state.interview.userId);
  const script = useSelector((state: RootState) => state.interview.script);
  const categoryStats = useSelector((state: RootState) => state.background.categoryStats);
  const clarificationRetryCount = useSelector((state: RootState) => state.background.clarificationRetryCount);

  const saveMessageToDb = useCallback(async (text: string, speaker: "user" | "ai" | "system") => {
    if (!sessionId) return;
    try {
      await fetch(`/api/interviews/session/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{
            text,
            speaker,
            stage: "background",
            timestamp: new Date().toISOString()
          }]
        })
      });
    } catch (err) {
      log.error(LOG_CATEGORY, "Failed to save message:", err);
    }
  }, [sessionId]);

  const handleSubmit = useCallback(
    async (answer: string, candidateName: string): Promise<AnswerHandlerResult> => {
      if (!companyName) {
        log.info(LOG_CATEGORY, "Submit blocked - missing companyName");
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

          // Feature flag check for split evaluation
          const useSplitEvaluation = process.env.NEXT_PUBLIC_USE_SPLIT_EVALUATION === 'true';

          try {
            const currentFocusTopic = backgroundState.currentFocusTopic;
            
            // Get excluded topics (dontKnowCount >= threshold)
            if (!process.env.NEXT_PUBLIC_DONT_KNOW_THRESHOLD) {
              throw new Error("NEXT_PUBLIC_DONT_KNOW_THRESHOLD environment variable is not set");
            }
            const dontKnowThreshold = parseInt(process.env.NEXT_PUBLIC_DONT_KNOW_THRESHOLD, 10);
            if (!Number.isFinite(dontKnowThreshold) || dontKnowThreshold < 1) {
              throw new Error("NEXT_PUBLIC_DONT_KNOW_THRESHOLD must be a positive integer");
            }
            
            const excludedTopics = categoryStats
              .filter(c => c.dontKnowCount >= dontKnowThreshold)
              .map(c => c.categoryName);

            if (excludedTopics.length > 0) {
              log.info(LOG_CATEGORY, `Excluded topics (dontKnowCount >= ${dontKnowThreshold}): ${excludedTopics.join(', ')}`);
            }

            // We no longer rely on exact detection here for incrementing since the server is the source of truth for updates

            if (useSplitEvaluation) {
              // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              // NEW FLOW: 3-call architecture (question, scoring, evaluation)
              // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

              // CALL 1: Next Question (BLOCKING, ~300-500ms)
              log.info(LOG_CATEGORY, "[split-eval] Calling next-question endpoint...");
              const questionResponse = await fetch(`/api/interviews/next-question`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  sessionId,
                  lastQuestion: currentQuestion,
                  lastAnswer: answer,
                  experienceCategories,
                  currentCounts: categoryStats,
                  currentFocusTopic,
                  excludedTopics,
                  clarificationRetryCount,
                })
              });

              const questionData = await questionResponse.json();
              log.info(LOG_CATEGORY, `[split-eval] Next question received in ${questionData.latencyMs || 0}ms`);

              // Check if all categories excluded
              if (questionData.allCategoriesExcluded) {
                log.info(LOG_CATEGORY, "All categories excluded - ending background interview");
                dispatch(setEvaluatingAnswer({ evaluating: false }));
                dispatch(forceTimeExpiry());
                return { shouldComplete: true, transitionReason: "all_categories_excluded" };
              }

              // Update focus topic immediately
              if (questionData.newFocusTopic) {
                dispatch(setCurrentFocusTopic({ topicName: questionData.newFocusTopic }));
              }

              // Use next question from response
              if (!questionData.question) {
                throw new Error("Next-question API must return question");
              }
              nextQuestionText = questionData.question;

              // Set question target for debug panel
              if (nextQuestionText && questionData.newFocusTopic) {
                dispatch(setCurrentQuestionTarget({ question: nextQuestionText, category: questionData.newFocusTopic }));
              }

              // Handle retry counter based on SERVER classification (OpenAI is source of truth)
              if (questionData.shouldIncrementRetry) {
                const retryType = questionData.isGibberish ? "Gibberish" : "Clarification";
                dispatch(incrementClarificationRetry());
                log.info(LOG_CATEGORY, `${retryType} detected by OpenAI, retry count now: ${clarificationRetryCount + 1}`);
              } else if (!questionData.shouldMoveOn) {
                // Normal answer - increment question sequence
                dispatch(incrementQuestionSequence());
              } else {
                // At threshold - moving to next question
                dispatch(incrementQuestionSequence());
                log.info(LOG_CATEGORY, "Retry threshold reached per OpenAI classification, moving to next question");
              }

              // Log if "I don't know" was detected by OpenAI
              if (questionData.isDontKnow && currentFocusTopic) {
                log.info(LOG_CATEGORY, `"I don't know" detected by OpenAI for category: ${currentFocusTopic}`);
              }

              // CALL 2: Score Answer (ASYNC, ~2-3s, non-blocking)
              log.info(LOG_CATEGORY, "[split-eval] Calling score-answer endpoint (async)...");
              fetch(`/api/interviews/score-answer`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  sessionId,
                  question: currentQuestion,
                  answer,
                  experienceCategories,
                  currentCounts: categoryStats,
                  currentFocusTopic,
                })
              }).then(async (scoreResponse) => {
                const scoreData = await scoreResponse.json();
                log.info(LOG_CATEGORY, `[split-eval] Scores received in ${scoreData.latencyMs || 0}ms`);


                // Update Redux with scores (~2-3s after submit)
                if (scoreData.updatedCounts) {
                  dispatch(updateCategoryStats({ stats: scoreData.updatedCounts }));
                  
                }

                // Pass intent to callback for display
                if (scoreData.evaluationIntent && onIntentReceived) {
                  onIntentReceived(scoreData.evaluationIntent);
                }

                // Log "I don't know" detection (OpenAI result is authoritative)
                if (scoreData.isDontKnow && currentFocusTopic) {
                  log.info(LOG_CATEGORY, `"I don't know" detected (OpenAI) for category: ${currentFocusTopic}`);
                }
              }).catch((err) => {
                log.error(LOG_CATEGORY, "[split-eval] Score-answer failed:", err);
              });

              // CALL 3: Full Evaluation (ASYNC, ~8-10s, non-blocking)
              log.info(LOG_CATEGORY, "[split-eval] Calling full evaluation endpoint (async)...");
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
                log.info(LOG_CATEGORY, "[split-eval] Full evaluation complete");


                // Correct Redux with full evaluation counts (if different)
                if (fullData.updatedCounts) {
                  // Re-fetch the absolute newest state from Redux right now
                  const currentReduxState = store.getState().background.categoryStats;
                  
                  const mergedCounts = fullData.updatedCounts.map((fullCat: any) => {
                    const reduxCat = currentReduxState.find((c: any) => c.categoryName === fullCat.categoryName);
                    return {
                      ...fullCat,
                      dontKnowCount: reduxCat?.dontKnowCount !== undefined ? reduxCat.dontKnowCount : fullCat.dontKnowCount, // Preserve dontKnowCount from newest Redux state!
                    };
                  });


                  dispatch(updateCategoryStats({ stats: mergedCounts }));
                  log.info(LOG_CATEGORY, "[split-eval] Redux updated with full-eval counts (dontKnowCount preserved from fresh state)");
                }

                // Pass evaluations to callback for debug panel
                if (fullData.allEvaluations && onEvaluationReceived) {
                  onEvaluationReceived({
                    timestamp: evalTimestamp,
                    question: currentQuestion,
                    answer,
                    evaluations: fullData.allEvaluations,
                  });
                }
              }).catch((err) => {
                log.error(LOG_CATEGORY, "[split-eval] Full evaluation failed:", err);
              });

            } else {
              // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              // OLD FLOW: Keep existing dual-call for backward compatibility
              // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

              log.info(LOG_CATEGORY, "[dual-call] Using old evaluate-answer-fast flow");
              const fastResponse = await fetch(`/api/interviews/evaluate-answer-fast`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sessionId,
                question: currentQuestion,
                answer,
                experienceCategories,
                currentCounts: categoryStats,
                currentFocusTopic,
                excludedTopics,
                clarificationRetryCount,
              })
            });
            
            const fastData = await fastResponse.json();
            
            // Check if all categories excluded
            if (fastData.allCategoriesExcluded) {
              log.info(LOG_CATEGORY, "All categories excluded - ending background interview");
              dispatch(setEvaluatingAnswer({ evaluating: false }));
              dispatch(forceTimeExpiry());
              return { shouldComplete: true, transitionReason: "all_categories_excluded" };
            }

            // Log if "I don't know" was detected by OpenAI (API handles the count increment)
            if (fastData.isDontKnow && currentFocusTopic) {
              log.info(LOG_CATEGORY, `"I don't know" detected by OpenAI for category: ${currentFocusTopic}`);
            }

            // Use fast results immediately
            if (fastData.updatedCounts) {
              updatedCategoryStats = fastData.updatedCounts;
              dispatch(updateCategoryStats({ stats: fastData.updatedCounts }));
            }
            
            // Update focus topic if changed
            if (fastData.newFocusTopic) {
              dispatch(setCurrentFocusTopic({ topicName: fastData.newFocusTopic }));
            }
            
            // Use next question from fast API
            if (!fastData.question) {
              throw new Error("Fast API must return question");
            }
            nextQuestionText = fastData.question;
            
            // Set question target for debug panel
            if (nextQuestionText && fastData.newFocusTopic) {
              dispatch(setCurrentQuestionTarget({ question: nextQuestionText, category: fastData.newFocusTopic }));
            }
            
            // Pass intent to callback for display after audio finishes
            if (fastData.evaluationIntent && onIntentReceived) {
              onIntentReceived(fastData.evaluationIntent);
            }

            // Handle retry counter based on SERVER classification (OpenAI is source of truth)
            if (fastData.isClarificationRequest || fastData.isGibberish) {
              const retryType = fastData.isGibberish ? "Gibberish" : "Clarification";
              // Candidate asked for clarification or gave gibberish
              if (clarificationRetryCount < 2) {
                // Under threshold - increment retry count (will prompt again)
                dispatch(incrementClarificationRetry());
                log.info(LOG_CATEGORY, `${retryType} detected by OpenAI, retry count now: ${clarificationRetryCount + 1}`);
              } else {
                // At threshold (3rd attempt) - move to next question
                dispatch(incrementQuestionSequence());
                log.info(LOG_CATEGORY, `Retry threshold reached (3) after ${retryType} detected by OpenAI, moving to next question`);
              }
            } else {
              // Normal answer - increment question sequence (new question asked)
              dispatch(incrementQuestionSequence());
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
                  currentCounts: updatedCategoryStats, // Use updated counts with dontKnowCount incremented
                })
              }).then(async (fullResponse) => {
                const fullData = await fullResponse.json();
                log.info(LOG_CATEGORY, "[dual-call] Full evaluation complete");

                // Update Redux with corrected counts from full evaluation
                if (fullData.updatedCounts) {
                  // Re-fetch the absolute newest state from Redux right now
                  const currentReduxState = store.getState().background.categoryStats;
                  
                  const mergedCounts = fullData.updatedCounts.map((fullCat: any) => {
                    const reduxCat = currentReduxState.find((c: any) => c.categoryName === fullCat.categoryName);
                    return {
                      ...fullCat,
                      dontKnowCount: reduxCat?.dontKnowCount !== undefined ? reduxCat.dontKnowCount : fullCat.dontKnowCount, 
                    };
                  });

                  dispatch(updateCategoryStats({ stats: mergedCounts }));
                  log.info(LOG_CATEGORY, "[dual-call] Redux updated with full-eval counts (dontKnowCount preserved from fresh state)");
                }

                if (fullData.allEvaluations && onEvaluationReceived) {
                  onEvaluationReceived({
                    timestamp: evalTimestamp,
                    question: currentQuestion,
                    answer,
                    evaluations: fullData.allEvaluations,
                  });
                }
              }).catch((err) => {
                log.error(LOG_CATEGORY, "[dual-call] Full evaluation failed:", err);
              });
            }

          } catch (err) {
            log.error(LOG_CATEGORY, useSplitEvaluation ? "Failed split evaluation:" : "Failed fast evaluation:", err);
          } finally {
            dispatch(setEvaluatingAnswer({ evaluating: false }));
          }
        }

        // Transition machine state
        const ms = store.getState().interview;
        log.info(LOG_CATEGORY, "Interview stage:", ms.stage);

        if (ms.stage === "background") {
          const backgroundState = store.getState().background;
          const timeboxMs = backgroundState.timeboxMs;
          const startedAtMs = backgroundState.startedAtMs;
          
          // Calculate confidence from updated counts (no DB fetch needed)
          const categories = updatedCategoryStats.map((stat: any) => {
            if (typeof stat.confidence !== "number") {
              throw new Error(`Missing confidence for background category ${stat.categoryName}`);
            }
            return {
              name: stat.categoryName,
              confidence: stat.confidence * 100,
              avgStrength: stat.avgStrength
            };
          });
          
          const transitionReason = shouldTransition(
            { startedAtMs, timeboxMs },
            { timeboxMs, categories }
          );

          log.info(LOG_CATEGORY, "Time gate check:", { transitionReason, categories });

          if (transitionReason) {
            // Time limit reached - generate closing response
            log.info(LOG_CATEGORY, `Time limit reached (${transitionReason})`);
            const persona = buildOpenAIBackgroundPrompt(String(companyName), script?.experienceCategories);
            const firstName = candidateName.split(" ")[0] || "Candidate";
            const closingInstruction = `Say exactly: "Thank you so much ${firstName}, the next steps will be shared with you shortly."`;

            try {
              const finalResponse = await generateAssistantReply(persona, closingInstruction);
              const responseText = finalResponse || "";
              
              dispatch(addMessage({ text: responseText, speaker: "ai" }));
              saveMessageToDb(responseText, "ai");
              
              const systemMsg = transitionReason === "all_topics_complete" 
                ? `[SYSTEM: All topics reached 100% confidence, transitioning to coding stage]`
                : `[SYSTEM: Background interview time limit reached, transitioning to coding stage]`;
              dispatch(addMessage({ text: systemMsg, speaker: "system" as any }));
              // Don't save system message to DB to keep transcript clean
              
              log.info(LOG_CATEGORY, "Final response generated");
            } catch (err) {
              log.error(LOG_CATEGORY, "Failed to generate final response:", err);
            }

            return { transitionReason, shouldComplete: true };
          } else {
            // PHASE 2: Use next question from fast API (no separate generation needed)
            log.info(LOG_CATEGORY, "Using next question from fast API");
            
            if (nextQuestionText) {
              dispatch(addMessage({ text: nextQuestionText, speaker: "ai" }));
              saveMessageToDb(nextQuestionText, "ai");
              log.info(LOG_CATEGORY, "Next question displayed");
            }

            return { shouldComplete: false };
          }
        }

        return { shouldComplete: false };
      } catch (error) {
        log.error(LOG_CATEGORY, "Error processing answer:", error);
        throw error;
      }
    },
    [dispatch, companyName, sessionId, userId, script, categoryStats, onEvaluationReceived, onIntentReceived, saveMessageToDb]
  );

  return { handleSubmit };
}
