"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { useSearchParams } from "next/navigation";
import OpenAI from "openai";
import { useDispatch } from "react-redux";
import {
  addMessage,
  setPendingReply,
  startPasteEvaluation,
  incrementPasteAnswer,
  setPasteQuestion,
  setPasteScore,
  setPasteReadyToEvaluate,
  updatePasteTopics,
  updatePasteQuestionScores,
  setPasteEvaluationSummary,
  updatePasteVideoMetadata,
  clearPasteEvaluation,
} from "@/shared/state/slices/codingSlice";
import { store } from "@/shared/state/store";
import {
  start as machineStart,
  setStage,
} from "@/shared/state/slices/interviewSlice";
import {
  buildOpenAIBackgroundPrompt,
  buildOpenAICodingPrompt,
  buildOpenAIInterviewerPrompt,
} from "@/shared/prompts/openAIInterviewerPrompt";
import { log as logger } from "app/shared/services";
import {
  askViaChatCompletion,
  generateAssistantReply,
} from "./openAITextConversationHelpers";
import {
  buildControlContextMessages,
  CONTROL_CONTEXT_TURNS,
} from "../../../../shared/services";

// Paste evaluation constants
const MAX_NUM_OF_TOPICS = 4; // Cap topics to ensure reasonable evaluation length

type Props = {
  candidateName: string;
  onStartConversation?: () => void;
  automaticMode?: boolean;
  onCodingPromptReady?: () => void;
  onGreetingDelivered?: () => void;
  onInterviewConcluded?: (delayMs?: number) => void;
  setInputLocked?: (locked: boolean) => void;
  onPasteDetected?: (pastedCode: string) => void;
  onHighlightPastedCode?: (pastedCode: string) => void;
  interviewSessionId?: string | null;
};

const OpenAITextConversation = forwardRef<any, Props>(
  ({
    candidateName,
    onStartConversation,
    automaticMode = false,
    onCodingPromptReady,
    onGreetingDelivered,
    onInterviewConcluded,
    setInputLocked,
    onPasteDetected,
    onHighlightPastedCode,
    interviewSessionId,
  }, ref) => {
    if (!candidateName) {
      throw new Error("OpenAITextConversation requires a candidateName");
    }
    
    const dispatch = useDispatch();
    const openAIApiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    if (!openAIApiKey) {
      throw new Error("NEXT_PUBLIC_OPENAI_API_KEY is required");
    }

    const MAX_PASTE_QUESTIONS = process.env.NEXT_PUBLIC_MAX_PASTE_QUESTIONS;
    if (!MAX_PASTE_QUESTIONS) {
      throw new Error("NEXT_PUBLIC_MAX_PASTE_QUESTIONS is required");
    }
    const questionsLimit = parseInt(MAX_PASTE_QUESTIONS, 10);
    if (isNaN(questionsLimit) || questionsLimit <= 0) {
      throw new Error("NEXT_PUBLIC_MAX_PASTE_QUESTIONS must be a positive integer");
    }

    const openaiClient = useMemo(
      () =>
        new OpenAI({
          apiKey: openAIApiKey,
          dangerouslyAllowBrowser: true,
        }),
      [openAIApiKey]
    );
    const readyRef = useRef(false);
    const scriptRef = useRef<any | null>(null);
    const codingPromptSentRef = useRef(false);
    const codingExpectedMessageRef = useRef<string | null>(null);

    const post = useCallback(
      (text: string, speaker: "user" | "ai", metadata?: { isPasteEval?: boolean; pasteEvaluationId?: string }) => {
        if (!text) return;
        dispatch(addMessage({ 
          text, 
          speaker, 
          isPasteEval: metadata?.isPasteEval,
          pasteEvaluationId: metadata?.pasteEvaluationId 
        }));
      },
      [dispatch]
    );

    const clearPendingState = useCallback(() => {
      dispatch(setPendingReply({ pending: false }));
    }, [dispatch]);

    const clearPendingAndThrow = useCallback(
      (message: string): never => {
        clearPendingState();
        throw new Error(message);
      },
      [clearPendingState]
    );

    const cancelPendingBackgroundReply = useCallback(() => {
      const isPending = store.getState().coding.pendingReply;
      if (!isPending) return;
      logger.info("[coding] Pending reply cancelled");
      clearPendingState();
    }, [clearPendingState]);

    const deliverAssistantPrompt = useCallback(
      async ({
        persona,
        instruction,
        pendingReason,
        autoPost = true,
        managePending = false,
      }: {
        persona: string;
        instruction: string;
        pendingReason?: string;
        autoPost?: boolean;
        managePending?: boolean;
      }) => {
        if (pendingReason) {
          logger.info(`[coding] Setting pending reply: ${pendingReason}`);
          dispatch(setPendingReply({ pending: true }));
        }
        try {
        const answer = await generateAssistantReply(openaiClient, persona, instruction);
        if (!answer) {
          if (pendingReason && !managePending) {
            dispatch(setPendingReply({ pending: false }));
          }
          return null;
        }
          if (autoPost) {
          const stage = store.getState().interview.stage;
          if (
            stage === "coding" &&
            pendingReason &&
            pendingReason.startsWith("background")
          ) {
            try {
              /* eslint-disable no-console */ console.log("[background][answer_dropped]", {
                pendingReason,
                stage: stage,
              });
            } catch {}
            logger.info(`[coding] Pending reply discarded: ${pendingReason}`);
            dispatch(setPendingReply({
              pending: true,
            }));
            return answer;
          }
        post(answer, "ai");
          // Unlock input when AI responds
          setInputLocked?.(false);
          }
          if (pendingReason && !managePending) {
            dispatch(setPendingReply({ pending: false }));
          }
          if (autoPost && onGreetingDelivered && instruction.includes("I'll be the one interviewing today!")) {
          try {
            onGreetingDelivered();
          } catch {}
        }
        return answer;
        } catch (error) {
          if (pendingReason && !managePending) {
            dispatch(setPendingReply({ pending: false }));
          }
          throw error;
        }
      },
      [dispatch, onGreetingDelivered, setInputLocked, openaiClient, post]
    );

    /** Handle paste detection during coding stage - Start evaluation flow */
    const handlePasteDetected = useCallback(
      async (pastedCode: string, timestamp: number) => {
        const ms = store.getState().interview;
        if (ms.stage !== "coding") return;
        
        const pasteEvaluationId = `paste-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        
        try {
          /* eslint-disable no-console */ console.log("[paste_eval][detected]", { 
            pasteEvaluationId, 
            pastedCode: pastedCode.substring(0, 100) + "...",
            timestamp 
          });
        } catch {}
        
        // Create video chapter IMMEDIATELY at paste detection
        let videoChapterId: string | undefined;
        if (interviewSessionId) {
          try {
            const chapterUrl = `/api/interviews/session/${interviewSessionId}/paste-chapter`;
            
            const response = await fetch(chapterUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                timestamp,
                caption: "External tool usage detected",
              }),
            });
            
            if (response.ok) {
              const data = await response.json();
              videoChapterId = data.chapterId;
              /* eslint-disable no-console */ console.log("✅ [paste_eval] Chapter created at paste detection", { videoChapterId });
            }
          } catch (error) {
            /* eslint-disable no-console */ console.error("❌ Failed to create paste chapter:", error);
          }
        }
        
        // Get coding context
        const codingPrompt = scriptRef.current?.codingPrompt;
        
        if (!codingPrompt) {
          /* eslint-disable no-console */ console.error("[paste_eval] Missing coding task");
          return;
        }
        
        // Phase 2: Identify topics for this pasted code
        let topics: Array<{ name: string; description: string; percentage: number }> = [];
        let initialQuestion = "";
        
        try {
          const topicsResponse = await fetch("/api/interviews/identify-paste-topics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pastedContent: pastedCode,
              codingTask: codingPrompt,
              maxTopics: MAX_NUM_OF_TOPICS,
            }),
          });
          
          if (topicsResponse.ok) {
            const topicsData = await topicsResponse.json();
            topics = topicsData.topics.map((t: any) => ({ ...t, percentage: 0 }));
            initialQuestion = topicsData.initialQuestion;
            /* eslint-disable no-console */ console.log("[paste_eval] Topics identified:", topics.length);
          } else {
            /* eslint-disable no-console */ console.warn("[paste_eval] Topic identification failed, using fallback");
          }
        } catch (error) {
          /* eslint-disable no-console */ console.error("[paste_eval] Topic identification error:", error);
        }
        
        // Fallback to simple question if topic identification failed
        if (!initialQuestion) {
          const initialPrompt = `You are a technical interviewer. A candidate just pasted this code:

${pastedCode}

The coding task they're working on: ${codingPrompt}

Ask ONE short, relevant question (1-2 sentences) to understand if they comprehend what they pasted. Don't evaluate yet, just ask.`;
          
          initialQuestion = await askViaChatCompletion(
            openaiClient,
            initialPrompt,
            []
          ) || "";
        }
        
        // Update debug panel - start evaluation with topics
        dispatch(startPasteEvaluation({
          pasteEvaluationId,
          pastedContent: pastedCode,
          timestamp,
          videoChapterId,
          topics,
        }));
        
        if (initialQuestion) {
          const aiQuestionTimestamp = Date.now();
          post(initialQuestion, "ai", { isPasteEval: true, pasteEvaluationId });
          
          // Trigger editor highlight now that AI question is posted
          onHighlightPastedCode?.(pastedCode);
          
          // Update debug panel with question
          dispatch(setPasteQuestion(initialQuestion));
          dispatch(updatePasteVideoMetadata({
            aiQuestionTimestamp,
            videoChapterId,
          }));
          
          try {
            /* eslint-disable no-console */ console.log("[paste_eval][question_asked]", { pasteEvaluationId, question: initialQuestion });
          } catch {}
        }
      },
      [dispatch, openaiClient, post, interviewSessionId, onHighlightPastedCode]
    );

    /** Injects the coding prompt once the guard advances into the coding session. */
    useEffect(() => {
      const checkAndSendCodingPrompt = () => {
        const ms = store.getState().interview;
        if (ms.stage !== "coding" || codingPromptSentRef.current) return;
        
        // Check if script is loaded
        if (!scriptRef.current) return;
        
        codingPromptSentRef.current = true;
        
        if (!ms.companyName) {
          throw new Error("Interview machine missing companyName for coding prompt");
        }
        const raw = scriptRef.current?.codingPrompt;
        if (typeof raw !== "string") {
          throw new Error("codingPrompt missing from script payload");
        }
        const taskText = raw.trim();
        if (!taskText) {
          throw new Error("codingPrompt is empty");
        }
        const persona = buildOpenAICodingPrompt(ms.companyName, taskText);
        try {
          /* eslint-disable no-console */ console.log("[coding][persona]", persona);
        } catch {}
        void (async () => {
          try {
            const codingSnapshot = store.getState().coding;
            const hadPending = codingSnapshot.pendingReply;
            if (hadPending) {
              cancelPendingBackgroundReply();
            }
            const backgroundState = store.getState().background;
            const reason = backgroundState.reason;
            
            // Persist background messages and trigger summary generation (fire-and-forget)
            // Note: Session ID needs to be passed from parent component or obtained from URL/context
            try {
              /* eslint-disable no-console */ console.log("[background][persist] Starting persistence flow");
              const backgroundMessages = backgroundState.messages.filter((msg) => {
                // Filter messages from background stage
                // For now, include all messages before this point (could enhance with explicit stage tracking)
                return true;
              }).map((msg) => ({
                speaker: msg.speaker,
                text: msg.text,
                stage: "background",
                timestamp: msg.timestamp,
              }));

              /* eslint-disable no-console */ console.log("[background][persist] Filtered messages count:", backgroundMessages.length);

              if (backgroundMessages.length > 0) {
                // Get session ID from Redux store
                const sessionId = ms.sessionId;
                
                /* eslint-disable no-console */ console.log("[background][persist] sessionId from Redux store:", sessionId);
                
                if (sessionId) {
                  // Save messages first (await to ensure they're persisted before summary generation)
                  /* eslint-disable no-console */ console.log("[background][persist] Calling POST /messages with", backgroundMessages.length, "messages");
                  
                  (async () => {
                    try {
                      const url = `/api/interviews/session/${sessionId}/messages`;
                      
                      const body: Record<string, any> = { messages: backgroundMessages };
                      
                      const messagesRes = await fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(body),
                      });
                      
                      /* eslint-disable no-console */ console.log("[background][persist] POST /messages response:", messagesRes.status, messagesRes.statusText);
                      const messagesData = await messagesRes.json();
                      /* eslint-disable no-console */ console.log("[background][persist] POST /messages data:", messagesData);
                      
                      if (!messagesRes.ok) {
                        /* eslint-disable no-console */ console.error("[background][persist] Failed to save messages, skipping summary generation");
                        return;
                      }
                      
                      // Messages saved successfully, now trigger summary generation
                      const summaryUrl = `/api/interviews/session/${sessionId}/background-summary`;
                      
                      const summaryPayload: Record<string, any> = {
                        companyName: ms.companyName,
                        roleName: ms.roleSlug?.replace(/-/g, " "),
                      };
                      
                      /* eslint-disable no-console */ console.log("[background][persist] Calling POST /background-summary with payload:", summaryPayload);
                      
                      try {
                        const summaryRes = await fetch(summaryUrl, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(summaryPayload),
                        });
                        
                        /* eslint-disable no-console */ console.log("[background][persist] POST /background-summary response:", summaryRes.status, summaryRes.statusText);
                        const summaryData = await summaryRes.json();
                        /* eslint-disable no-console */ console.log("[background][persist] POST /background-summary data:", summaryData);
                      } catch (summaryErr) {
                        /* eslint-disable no-console */ console.error("[background][persist] Failed to generate summary:", summaryErr);
                      }
                    } catch (err) {
                      /* eslint-disable no-console */ console.error("[background][persist] Error in persistence flow:", err);
                    }
                  })();
                } else {
                  /* eslint-disable no-console */ console.error("[background][persist] sessionId is null, cannot persist");
                }
              } else {
                /* eslint-disable no-console */ console.warn("[background][persist] No messages to persist");
              }
            } catch (persistError) {
              /* eslint-disable no-console */ console.error("[background][persist] Error persisting data:", persistError);
            }
            
            // Post the coding task directly without OpenAI transformation
            try {
              /* eslint-disable no-console */ console.log("[coding][posting_task]", taskText);
            } catch {}
            post(taskText, "ai");
            if (automaticMode && onCodingPromptReady) {
              try {
                onCodingPromptReady();
              } catch {}
            }
          } catch (error) {
            /* eslint-disable no-console */ console.error("[coding] Failed to send coding prompt:", error);
            throw error;
          }
        })();
      };
      
      // Check immediately on mount/deps change
      checkAndSendCodingPrompt();
      
      // Also subscribe to future changes
      const unsubscribe = store.subscribe(checkAndSendCodingPrompt);
      return () => unsubscribe();
    }, [
      automaticMode,
      cancelPendingBackgroundReply,
      clearPendingAndThrow,
      deliverAssistantPrompt,
      onCodingPromptReady,
      dispatch,
      post,
    ]);

    const sendUserMessage = useCallback(
      async (text: string) => {
        try {
          /* eslint-disable no-console */ console.log("[text][send]", text);
        } catch {}
        
        // Check if we're in active paste evaluation to tag message
        const codingState = store.getState().coding;
        const activePasteEval = codingState.activePasteEvaluation;
        const isPasteEvalActive = !!activePasteEval;
        
        post(text, "user", { 
          isPasteEval: isPasteEvalActive,
          pasteEvaluationId: activePasteEval?.pasteEvaluationId,
        });
        // Lock input when user sends message
        setInputLocked?.(true);
        try {
          /* eslint-disable no-console */ console.log(
            "[text][after userFinal]",
            { stage: store.getState().interview.stage }
          );
        } catch {}

        const ms = store.getState().interview;
        if (ms.stage === "greeting") {
          const expectedQ = scriptRef.current?.backgroundQuestion;
          if (expectedQ) {
            const persona = buildOpenAIBackgroundPrompt(
              String(ms.companyName || "Company"),
              scriptRef.current?.experienceCategories
            );
            const instruction = `Ask exactly: "${String(expectedQ)}"`;
            const reply = await deliverAssistantPrompt({
              persona,
              instruction,
              pendingReason: "background_question",
            });
            if (reply) {
              dispatch(setStage({ stage: "background" }));
            }
            return;
          }
        }

        if (ms.stage === "background") {
          // Set pending state BEFORE control run
          logger.info("[coding] Setting pending for background followup");
          dispatch(setPendingReply({
            pending: true,
          }));
          
          // Ask for follow-up
          const im = store.getState().interview;
          if (!im.companyName) {
            throw new Error("Interview machine missing companyName");
          }
          const persona = buildOpenAIBackgroundPrompt(String(im.companyName), scriptRef.current?.experienceCategories);
          const follow = await askViaChatCompletion(openaiClient, persona, [
            {
              role: "assistant",
              content: "Ask one short follow-up about their project.",
            },
            { role: "user", content: text },
          ]);
          if (follow) {
            const stage = store.getState().interview.stage;
            if (stage === "coding") {
              logger.info("[coding] Background followup discarded - already in coding");
              dispatch(setPendingReply({
                pending: true,
              }));
              try {
                /* eslint-disable no-console */ console.log("[background][followup_dropped]", {
                  follow,
                  stage: stage,
                });
              } catch {}
              return;
            }
            post(follow, "ai");
            // Unlock input when AI responds
            setInputLocked?.(false);
            clearPendingState();
          } else {
            clearPendingState();
          }
          return;
        }

        // Handle coding stage messages
        if (ms.stage === "coding") {
          try {
            /* eslint-disable no-console */ console.log("[coding][user_message]", text);
          } catch {}
          
          // Check if we're in an active paste evaluation
          const codingState = store.getState().coding;
          const activePasteEval = codingState.activePasteEvaluation;
          
          if (activePasteEval) {
            // Handle paste evaluation flow with CONTROL messages
            // Increment answer count AFTER user answers
            const nextAnswerCount = activePasteEval.answerCount + 1;
            
            try {
              /* eslint-disable no-console */ console.log("[paste_eval][user_answer]", { 
                id: activePasteEval.pasteEvaluationId,
                answerCount: nextAnswerCount,
                userText: text
              });
            } catch {}
            
            const codingPrompt = scriptRef.current?.codingPrompt;
            if (!codingPrompt) {
              /* eslint-disable no-console */ console.error("[paste_eval] Missing coding task");
              setInputLocked?.(false);
              return;
            }
            
            // Build paste evaluation prompt with CONTROL format
            // Get raw messages directly from store (not filtered by buildControlContextMessages)
            const rawMessages = store.getState().coding.messages;
            
            // Only get paste eval messages AFTER the paste timestamp
            const pasteConversation = rawMessages
              .filter(m => m.isPasteEval && m.timestamp >= activePasteEval.timestamp)
              .map(m => ({
                role: m.speaker === "user" ? "user" as const : "assistant" as const,
                content: m.text,
              }));
            
            try {
              /* eslint-disable no-console */ console.log("[paste_eval][conversation_extracted]", {
                totalMessages: rawMessages.length,
                pasteEvalMessages: pasteConversation.length,
                pasteTimestamp: activePasteEval.timestamp
              });
            } catch {}
            
            const conversationHistory = pasteConversation
              .map(m => `${m.role === "user" ? "Candidate" : "AI"}: ${m.content}`)
              .join("\n");
            
            // Phase 2: Build topic coverage summary for prompt
            const topics = activePasteEval.topics || [];
            const topicSummary = topics.length > 0
              ? topics.map(t => `- ${t.name}: ${t.percentage}% covered`).join("\n")
              : "No topics identified";
            const avgTopicCoverage = topics.length > 0
              ? Math.round(topics.reduce((sum, t) => sum + t.percentage, 0) / topics.length)
              : 0;
            const unansweredTopics = topics.filter(t => t.percentage === 0);
            
            const pasteEvalPrompt = `You are helping evaluate a candidate's understanding of code they pasted during an interview.

**Context:**
- Pasted code: ${activePasteEval.pastedContent}
- Task: ${codingPrompt}
- Conversation so far: ${conversationHistory || "Just started"}
- This is question ${nextAnswerCount} of ${questionsLimit}

**Current Topic Coverage:**
${topics.length > 0 
  ? topics.map(t => `- ${t.name}: ${t.percentage}% (goal: 100%)`).join('\n')
  : "No topics identified"}

**Your Job:**
Generate ONE short, focused follow-up question (1-2 sentences max) to deepen their understanding.
- Target the topic with the LOWEST percentage to maximize learning
- Ask progressively harder questions to push toward 100% mastery
- Be conversational and encouraging

**Example Questions:**
"Can you elaborate on how the exponential growth affects memory usage?"
"What happens if you need to support more qubits?"
"How would you optimize this for larger state vectors?"

Generate your question now:`;
            
            // Get conversation history (only messages AFTER paste)
            const historyMessages = pasteConversation;
            
            // Evaluate this specific Q&A pair immediately
            const lastQuestion = pasteConversation
              .filter(m => m.role === "assistant")
              .slice(-1)[0]?.content || "";
            const lastAnswer = text;
            
            // Phase 2: Get current topic coverage
            const currentTopics = activePasteEval.topics || [];
            const currentCoverage = currentTopics.reduce((acc, t) => {
              acc[t.name] = t.percentage;
              return acc;
            }, {} as Record<string, number>);
            
            let questionScore = null;
            if (lastQuestion && lastAnswer) {
              try {
                const scoreResponse = await fetch("/api/interviews/evaluate-paste-accountability", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    pastedContent: activePasteEval.pastedContent,
                    question: lastQuestion,
                    answer: lastAnswer,
                    codingTask: codingPrompt,
                    questionNumber: nextAnswerCount,
                    currentTopicCoverage: currentCoverage,
                  }),
                });
                
                if (scoreResponse.ok) {
                  questionScore = await scoreResponse.json();
                  /* eslint-disable no-console */ console.log(`[paste_eval][Q${nextAnswerCount}_score]`, questionScore);
                }
              } catch (e) {
                /* eslint-disable no-console */ console.error("[paste_eval] Failed to score Q&A:", e);
              }
            }
            
            // Calculate updated topics first (before checking coverage)
            const currentScoresBeforeUpdate = activePasteEval.questionScores || [];
            const enhancedQuestionScore = questionScore ? {
              question: lastQuestion,
              answer: lastAnswer,
              score: questionScore.score,
              reasoning: questionScore.reasoning,
              understandingLevel: questionScore.understandingLevel,
              topicsAddressed: questionScore.topicsAddressed || [],
            } : null;
            
            const updatedScores = enhancedQuestionScore
              ? [...currentScoresBeforeUpdate, enhancedQuestionScore]
              : currentScoresBeforeUpdate;
            
            let updatedTopics = currentTopics;
            if (currentTopics.length > 0 && updatedScores.length > 0) {
              updatedTopics = currentTopics.map(topic => {
                const relatedScores = updatedScores
                  .filter(qs => qs.topicsAddressed?.includes(topic.name))
                  .map(qs => qs.score);
                
                if (relatedScores.length > 0) {
                  const avgScore = Math.round(
                    relatedScores.reduce((sum, score) => sum + score, 0) / relatedScores.length
                  );
                  return {
                    ...topic,
                    percentage: avgScore,
                    lastUpdatedBy: nextAnswerCount,
                  };
                }
                return topic;
              });
            }
            
            // Check if all topics are covered using the UPDATED topics
            const allTopicsMaximized = updatedTopics.length > 0 && updatedTopics.every(t => t.percentage === 100);
            const questionLimitReached = nextAnswerCount >= questionsLimit;
            const candidateSaidIDontKnow = text.toLowerCase().includes("i don't know");
            const shouldEvaluate = allTopicsMaximized || questionLimitReached || candidateSaidIDontKnow;
            
            // If evaluation complete, post static message and exit
            if (shouldEvaluate) {
              const exitMessage = "Thanks for explaining. Let's continue with your implementation.";
              post(exitMessage, "ai");  // No paste eval ID - normal styling
              
              // Clear only the editor highlighting, keep debug panel data visible
              if ((window as any).__clearPasteHighlight) {
                (window as any).__clearPasteHighlight();
              }
              
              try {
                /* eslint-disable no-console */ console.log("[paste_eval][acknowledgment_sent]", {
                  text: exitMessage,
                  reason: allTopicsMaximized ? "all_topics_100" : questionLimitReached ? "question_limit" : "i_dont_know"
                });
              } catch {}
              
              clearPendingState();
            } else {
              // Continue evaluation - generate next question from OpenAI
              // Set pending state before API call
              logger.info("[coding] Setting pending for paste eval followup");
              dispatch(setPendingReply({
                pending: true,
              }));
              
              // Generate AI follow-up question
              const aiQuestion = await askViaChatCompletion(
                openaiClient,
                pasteEvalPrompt,
                historyMessages
              );
              
              if (!aiQuestion) {
                clearPendingState();
                setInputLocked?.(false);
                return;
              }
              
              try {
                /* eslint-disable no-console */ console.log("[paste_eval][question]", aiQuestion);
              } catch {}
              
              // Post follow-up question - keep green highlighting
              post(aiQuestion, "ai", { isPasteEval: true, pasteEvaluationId: activePasteEval.pasteEvaluationId });
              clearPendingState();
            }
            
            // Update state regardless of exit or continue
            // Calculate pasteAccountabilityScore as average of all topic percentages
            const calculatedScore = updatedTopics.length > 0
              ? Math.round(updatedTopics.reduce((sum, t) => sum + t.percentage, 0) / updatedTopics.length)
              : 0;
            
            try {
              /* eslint-disable no-console */ console.log("[paste_eval][score_calculation]", {
                updatedTopics: updatedTopics.map(t => ({ name: t.name, percentage: t.percentage })),
                calculatedScore,
              });
            } catch {}
            
            dispatch(setPasteScore(calculatedScore));
            dispatch(incrementPasteAnswer());
            dispatch(setPasteReadyToEvaluate(shouldEvaluate));
            dispatch(updatePasteQuestionScores(updatedScores));
            if (updatedTopics.length > 0) {
              dispatch(updatePasteTopics(updatedTopics));
            }
            
            // If ready to evaluate, aggregate per-question scores
            if (shouldEvaluate) {
              try {
                /* eslint-disable no-console */ console.log("[paste_eval][ready_to_evaluate]", {
                  id: activePasteEval.pasteEvaluationId,
                  pasteAccountabilityScore: calculatedScore,
                });
              } catch {}
                
                // Use local variables (have latest values before state update)
                const questionScores = updatedScores;
                const finalTopics = updatedTopics;
                
                // Calculate average score from ALL topic percentages (strict)
                // Questions are just a pipe to feed topic scores
                const avgScore = finalTopics.length > 0
                  ? Math.round(finalTopics.reduce((sum, t) => sum + t.percentage, 0) / finalTopics.length)
                  : 0;
                
                // Determine overall understanding level based on topic average
                const understanding = avgScore >= 80 ? "FULL" : avgScore >= 50 ? "PARTIAL" : "NONE";
                
                // Call OpenAI for final summary
                let summary = "";
                try {
                  const summaryResponse = await fetch("/api/interviews/generate-paste-summary", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      pastedContent: activePasteEval.pastedContent,
                      questionAnswers: questionScores,
                      averageScore: avgScore,
                    }),
                  });
                  
                  if (summaryResponse.ok) {
                    const summaryData = await summaryResponse.json();
                    summary = summaryData.summary;
                  } else {
                    // Fallback if summary API fails
                    summary = `Candidate answered ${questionScores.length} questions with average score ${avgScore}/100`;
                    /* eslint-disable no-console */ console.warn("[paste_eval] Summary API failed, using fallback");
                  }
                } catch (error) {
                  // Fallback on error
                  summary = `Candidate answered ${questionScores.length} questions with average score ${avgScore}/100`;
                  /* eslint-disable no-console */ console.error("[paste_eval] Summary API error:", error);
                }
                
                const caption = `External tool: ${understanding.toLowerCase()} understanding (${avgScore}/100)`;
                
                const evaluation = {
                  understanding,
                  accountabilityScore: avgScore,
                  reasoning: summary,
                  caption,
                };
                
                try {
                  /* eslint-disable no-console */ console.log("[paste_eval][aggregated_evaluation]", {
                    questionCount: questionScores.length,
                    scores: questionScores.map(qs => qs.score),
                    avgScore,
                    evaluation
                  });
                } catch {}
                
                // Validation: ensure we have valid data before DB save
                if (questionScores.length === 0) {
                  /* eslint-disable no-console */ console.error("[paste_eval][validation_error] No questions were scored");
                  setInputLocked?.(false);
                  return;
                }
                
                if (!summary || summary.trim() === "") {
                  /* eslint-disable no-console */ console.error("[paste_eval][validation_error] Summary is empty");
                  // Use fallback summary
                  evaluation.reasoning = `Candidate answered ${questionScores.length} questions with average score ${avgScore}/100`;
                }
                
                if (evaluation) {
                  
                  try {
                    /* eslint-disable no-console */ console.log("[paste_eval][evaluation_result]", evaluation);
                  } catch {}
                  
                  // Combine conversation for DB storage
                  const userAnswers = pasteConversation
                    .filter(m => m.role === "user")
                    .map(m => m.content)
                    .join(" ");
                  const aiQuestions = pasteConversation
                    .filter(m => m.role === "assistant")
                    .map(m => m.content)
                    .join(" ");
                  
                  // Update debug panel with final evaluation
                  dispatch(setPasteScore(avgScore));
                  dispatch(incrementPasteAnswer());
                  dispatch(setPasteReadyToEvaluate(true));
                  dispatch(setPasteEvaluationSummary({
                    reasoning: evaluation.reasoning,
                    caption: evaluation.caption,
                    finalScore: evaluation.accountabilityScore,
                  }));
                  
                  // Save to DB
                  const sessionId = ms.sessionId;
                  if (sessionId && activePasteEval.aiQuestionTimestamp) {
                    const dbPayload = {
                      timestamp: activePasteEval.timestamp,
                      pastedContent: activePasteEval.pastedContent,
                      characterCount: activePasteEval.pastedContent.length,
                      aiQuestion: aiQuestions || "",
                      aiQuestionTimestamp: activePasteEval.aiQuestionTimestamp,
                      userAnswer: userAnswers || "",
                      understanding: evaluation.understanding,
                      accountabilityScore: evaluation.accountabilityScore,
                      reasoning: evaluation.reasoning,
                      caption: evaluation.caption,
                    };
                    
                    try {
                      /* eslint-disable no-console */ console.log("[paste_eval][saving_to_db]", dbPayload);
                    } catch {}
                    
                    const dbResponse = await fetch(`/api/interviews/session/${sessionId}/external-tools`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(dbPayload),
                    });
                    
                    if (dbResponse.ok) {
                      try {
                        /* eslint-disable no-console */ console.log("[paste_eval][saved_to_db]");
                      } catch {}
                      
                      // Update VideoCaption with accountability evaluation
                      if (activePasteEval.videoChapterId) {
                        try {
                          await fetch(`/api/interviews/video-chapter/${activePasteEval.videoChapterId}/caption`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ caption: evaluation.caption }),
                          });
                          /* eslint-disable no-console */ console.log("✅ [paste_eval] VideoCaption updated with evaluation");
                        } catch (error) {
                          /* eslint-disable no-console */ console.error("❌ Failed to update VideoCaption:", error);
                        }
                      }
                    } else {
                      try {
                        const errorData = await dbResponse.json();
                        /* eslint-disable no-console */ console.error("[paste_eval][db_error]", {
                          status: dbResponse.status,
                          error: errorData
                        });
                      } catch {}
                    }
                  } else {
                    try {
                      /* eslint-disable no-console */ console.error("[paste_eval][missing_data]", {
                        hasSessionId: !!sessionId,
                        hasAiTimestamp: !!activePasteEval.aiQuestionTimestamp
                      });
                    } catch {}
                  }
                }
                
                // Note: Paste evaluation and highlighting already cleared when acknowledgment was posted
              }
            
            setInputLocked?.(false);
            return;
          }
          
          // Normal coding stage conversation (no active paste evaluation)
          const codingPrompt = scriptRef.current?.codingPrompt;
          const codingAnswer = scriptRef.current?.codingAnswer;
          const codingTemplate = scriptRef.current?.codingTemplate;
          
          if (!codingPrompt || !codingAnswer || !codingTemplate) {
            /* eslint-disable no-console */ console.error("[coding] Missing coding context from script");
            setInputLocked?.(false);
            return;
          }
          
          // Build system prompt with coding persona
          const companyName = ms.companyName || "Company";
          const codingPersona = buildOpenAICodingPrompt(companyName, codingPrompt);
          
          // Add context about template and expected answer to the system prompt
          let systemPrompt = `${codingPersona}`;
          
          
          systemPrompt += `

Reference Information:
Starting Template:
${codingTemplate}

Expected Solution:
${codingAnswer}

The candidate is working on this task. Respond to their question while following the behavioral rules above.`;
          
          // Get conversation history (last 30 messages, filtered for paste eval)
          const historyMessages = buildControlContextMessages(CONTROL_CONTEXT_TURNS);
          
          // Set pending state before API call
          logger.info("[coding] Setting pending for coding question");
          dispatch(setPendingReply({
            pending: true,
          }));
          
          // Generate AI response using chat completions
          const reply = await askViaChatCompletion(
            openaiClient,
            systemPrompt,
            historyMessages
          );
          
          if (reply) {
            post(reply, "ai");
            clearPendingState();
            setInputLocked?.(false);
            try {
              /* eslint-disable no-console */ console.log("[coding][ai_response]", reply);
            } catch {}
          } else {
            clearPendingState();
            setInputLocked?.(false);
          }
          
          return;
        }
      },
      [clearPendingState, deliverAssistantPrompt, dispatch, setInputLocked, openaiClient, post, questionsLimit]
    );

    const startConversation = useCallback(async () => {
      if (readyRef.current) return;
      readyRef.current = true;
      const ms = store.getState().interview;
      const { companySlug, roleSlug } = ms;
      if (!companySlug) {
        throw new Error("Interview machine missing companySlug");
      }
      if (!roleSlug) {
        throw new Error("Interview machine missing roleSlug");
      }
      const resp = await fetch(
        `/api/interviews/script?company=${companySlug}&role=${roleSlug}`
      );
      if (!resp.ok) {
        const detail =
          (await resp.text().catch(() => "")) || resp.statusText || "unknown";
        throw new Error(
          `Failed to load interview script for ${companySlug}/${roleSlug}: ${detail}`
        );
      }
      const data = await resp.json();
      scriptRef.current = data;
      codingPromptSentRef.current = false;
      
      // Interview page: No greeting, no state machine start
      // State machine will be forced to coding by InterviewIDE after this completes
      try {
        /* eslint-disable no-console */ console.log("[OpenAITextConversation] Script loaded, ready for coding transition");
      } catch {}
      
      try {
        onStartConversation?.();
      } catch {}
    }, [onStartConversation]);

    const sayClosingLine = useCallback(
      async (name?: string) => {
        // Skip posting closing message - completion message already shown on screen
        try {
          onInterviewConcluded?.(2700);
        } catch {}
      },
      [onInterviewConcluded]
    );

    useImperativeHandle(ref, () => ({
      startConversation,
      sendUserMessage,
      sayClosingLine,
      handlePasteDetected,
    }));

    return null;
  }
);

OpenAITextConversation.displayName = "OpenAITextConversation";

export default OpenAITextConversation;