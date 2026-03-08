"use client";

import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEW_UI;

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { useSearchParams } from "next/navigation";
import { useDispatch } from "react-redux";
import { useMute } from "app/shared/contexts/mute-context";
import { loadAndCacheSoundEffect } from "@/shared/utils/audioCache";
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
} from "@/shared/prompts/openAIInterviewerPrompt";
import {
  askViaChatCompletion,
  generateAssistantReply,
} from "./openAITextConversationHelpers";
import {
  buildControlContextMessages,
  CONTROL_CONTEXT_TURNS,
} from "../../../../shared/services";
import { formatInitialTaskMessage } from "@/shared/utils/formatTaskMessage";

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
    const { isMuted } = useMute();
    const toolUsageSoundRef = useRef<HTMLAudioElement | null>(null);
    const MAX_PASTE_QUESTIONS = process.env.NEXT_PUBLIC_MAX_PASTE_QUESTIONS;
    if (!MAX_PASTE_QUESTIONS) {
      throw new Error("NEXT_PUBLIC_MAX_PASTE_QUESTIONS is required");
    }
    const questionsLimit = parseInt(MAX_PASTE_QUESTIONS, 10);
    if (isNaN(questionsLimit) || questionsLimit <= 0) {
      throw new Error("NEXT_PUBLIC_MAX_PASTE_QUESTIONS must be a positive integer");
    }

    // Load tool usage sound effect on mount
    useEffect(() => {
      loadAndCacheSoundEffect("/sounds/controls-appear.mp3", "controls-appear").then(sound => {
        toolUsageSoundRef.current = sound;
      });
    }, []);

    const readyRef = useRef(false);
    const scriptRef = useRef<any | null>(null);
    const codingPromptSentRef = useRef(false);
    const codingExpectedMessageRef = useRef<string | null>(null);

    /** Wall-clock time when AI follow-up question was posted to chat. */
    const aiQuestionTimestampRef = useRef<number | null>(null);
    /** True after paste evaluation has been persisted to ExternalToolUsage. */
    const savedToDbRef = useRef(false);
    /** Mutex: true while a DB save is in-flight (prevents concurrent POSTs). */
    const savingRef = useRef(false);

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
      /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[coding] Pending reply cancelled");
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
          /* eslint-disable no-console */ log.info(LOG_CATEGORY, `[coding] Setting pending reply: ${pendingReason}`);
          dispatch(setPendingReply({ pending: true }));
        }
        try {
        const answer = await generateAssistantReply(persona, instruction);
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
              /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[background][answer_dropped]", {
                pendingReason,
                stage: stage,
              });
            } catch {}
            /* eslint-disable no-console */ log.info(LOG_CATEGORY, `[coding] Pending reply discarded: ${pendingReason}`);
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
      [dispatch, onGreetingDelivered, setInputLocked, post]
    );

    /**
     * Persists any unsaved paste evaluation to ExternalToolUsage.
     * Called on interview conclusion or before a second paste overwrites the first.
     */
    const flushPendingPasteEval = useCallback(async () => {
      if (savedToDbRef.current || savingRef.current) return;

      const codingState = store.getState().coding;
      const activePasteEval = codingState.activePasteEvaluation;
      const sessionId = store.getState().interview.sessionId;

      if (!activePasteEval || !sessionId) return;
      if (activePasteEval.accountabilityScore !== undefined) return;

      savingRef.current = true;
      try {
        const hasPartialAnswers = activePasteEval.questionScores && activePasteEval.questionScores.length > 0;
        const ts = aiQuestionTimestampRef.current;
        if (!ts) {
          log.error(LOG_CATEGORY, "[paste_eval][flush] aiQuestionTimestampRef is null — skipping DB save");
          return;
        }

        if (hasPartialAnswers) {
          const topics = activePasteEval.topics || [];
          const avgScore = topics.length > 0
            ? Math.round(topics.reduce((sum, t) => sum + t.percentage, 0) / topics.length)
            : 0;
          const understanding = avgScore >= 80 ? "full" : avgScore >= 50 ? "partial" : "none";

          let evaluation = "Candidate provided partial answers before submitting.";
          try {
            const resp = await fetch("/api/interviews/generate-paste-summary", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                pastedContent: activePasteEval.pastedContent,
                questionAnswers: activePasteEval.questionScores,
                averageScore: avgScore,
              }),
            });
            if (resp.ok) {
              const data = await resp.json();
              evaluation = data.summary || evaluation;
            }
          } catch (e) {
            log.error(LOG_CATEGORY, "[paste_eval][flush] Summary API error:", e);
          }

          const dbPayload = {
            timestamp: activePasteEval.timestamp,
            pastedContent: activePasteEval.pastedContent,
            characterCount: activePasteEval.pastedContent.length,
            aiQuestion: (activePasteEval.questionScores ?? []).map((qs: any) => qs.question).join("\n"),
            aiQuestionTimestamp: ts,
            userAnswer: (activePasteEval.questionScores ?? []).map((qs: any) => qs.answer).join("\n"),
            understanding,
            accountabilityScore: avgScore,
            reasoning: evaluation,
            caption: evaluation,
          };

          const resp = await fetch(`/api/interviews/session/${sessionId}/external-tools`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dbPayload),
          });
          if (resp.ok) savedToDbRef.current = true;
          else log.error(LOG_CATEGORY, "[paste_eval][flush] API error:", resp.status);
        } else {
          const evaluation = "The candidate did not respond to questions about the pasted code.";
          const dbPayload = {
            timestamp: activePasteEval.timestamp,
            pastedContent: activePasteEval.pastedContent,
            characterCount: activePasteEval.pastedContent.length,
            aiQuestion: activePasteEval.topics?.map((t: any) => t.question).join("\n") || "No response provided",
            aiQuestionTimestamp: ts,
            userAnswer: "",
            understanding: "none",
            accountabilityScore: 0,
            reasoning: evaluation,
            caption: evaluation,
          };

          const resp = await fetch(`/api/interviews/session/${sessionId}/external-tools`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dbPayload),
          });
          if (resp.ok) savedToDbRef.current = true;
          else log.error(LOG_CATEGORY, "[paste_eval][flush] API error:", resp.status);
        }
      } catch (error) {
        log.error(LOG_CATEGORY, "[paste_eval][flush] Failed:", error);
      } finally {
        savingRef.current = false;
      }
    }, []);

    /** Handle paste detection during coding stage - Start evaluation flow */
    const handlePasteDetected = useCallback(
      async (pastedCode: string, timestamp: number) => {
        const ms = store.getState().interview;
        if (ms.stage !== "coding") return;

        // Fix 4: flush any previous unsaved paste evaluation before starting a new one
        if (!savedToDbRef.current && store.getState().coding.activePasteEvaluation) {
          await flushPendingPasteEval();
          dispatch(clearPasteEvaluation());
        }

        // Reset local refs for this new paste cycle
        aiQuestionTimestampRef.current = null;
        savedToDbRef.current = false;
        savingRef.current = false;
        
        const pasteEvaluationId = `paste-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        
        try {
          /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[paste_eval][detected]", { 
            pasteEvaluationId, 
            pastedCode: pastedCode.substring(0, 100) + "...",
            timestamp 
          });
        } catch {}
        
        // VideoChapter removed - evidence links use aiQuestionTimestamp from ExternalToolUsage
        
        // Get coding context
        const codingPrompt = scriptRef.current?.codingPrompt;
        
        if (!codingPrompt) {
          /* eslint-disable no-console */ log.error(LOG_CATEGORY, "[paste_eval] Missing coding task");
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

            // If GPT determined the content is not code or not task-relevant, silently ignore the paste
            if (topicsData.relevant === false) {
              /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[paste_eval] Content not relevant to coding task — ignoring paste");
              return;
            }

            topics = topicsData.topics.map((t: any) => ({ ...t, percentage: 0 }));
            initialQuestion = topicsData.initialQuestion;
            /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[paste_eval] Topics identified:", topics.length);
          } else {
            /* eslint-disable no-console */ log.warn(LOG_CATEGORY, "[paste_eval] Topic identification failed, using fallback");
          }
        } catch (error) {
          /* eslint-disable no-console */ log.error(LOG_CATEGORY, "[paste_eval] Topic identification error:", error);
        }
        
        // Fallback to simple question if topic identification failed
        if (!initialQuestion) {
          const initialPrompt = `You are a technical interviewer. A candidate just pasted this code:

${pastedCode}

The coding task they're working on: ${codingPrompt}

Ask ONE short, relevant question (1-2 sentences) to understand if they comprehend what they pasted. Don't evaluate yet, just ask.`;
          
          initialQuestion = await askViaChatCompletion(
            initialPrompt,
            []
          ) || "";
        }
        
        // Update debug panel - start evaluation with topics
        dispatch(startPasteEvaluation({
          pasteEvaluationId,
          pastedContent: pastedCode,
          timestamp,
          topics,
        }));
        
        if (initialQuestion) {
          // Capture wall-clock time when AI follow-up is posted (evidence clip anchor)
          aiQuestionTimestampRef.current = Date.now();
          post(initialQuestion, "ai", { isPasteEval: true, pasteEvaluationId });

          if (toolUsageSoundRef.current) {
            try {
              toolUsageSoundRef.current.volume = isMuted ? 0 : 1;
              toolUsageSoundRef.current.currentTime = 0;
              toolUsageSoundRef.current.play().catch(err => log.error(LOG_CATEGORY, "Tool usage sound error:", err));
            } catch (error) {
              log.error(LOG_CATEGORY, "[paste_eval] Failed to play tool usage sound:", error);
            }
          }

          onHighlightPastedCode?.(pastedCode);

          dispatch(setPasteQuestion(initialQuestion));

          try {
            /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[paste_eval][question_asked]", { pasteEvaluationId, question: initialQuestion });
          } catch {}
        }
      },
      [dispatch, post, interviewSessionId, onHighlightPastedCode, isMuted, flushPendingPasteEval]
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
          /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[coding][persona]", persona);
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
              /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[background][persist] Starting persistence flow");
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

              /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[background][persist] Filtered messages count:", backgroundMessages.length);

              if (backgroundMessages.length > 0) {
                // Get session ID and user ID from Redux store
                const sessionId = ms.sessionId;
                const userId = ms.userId;

                /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[background][persist] sessionId from Redux store:", sessionId);
                /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[background][persist] userId from Redux store:", userId);

                if (sessionId && userId) {
                  // Save messages first (await to ensure they're persisted before summary generation)
                  /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[background][persist] Calling POST /messages with", backgroundMessages.length, "messages");
                  
                  (async () => {
                    try {
                      const url = `/api/interviews/session/${sessionId}/messages?skip-auth=true`;

                      const body: Record<string, any> = {
                        messages: backgroundMessages,
                        userId: userId
                      };

                      const messagesRes = await fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(body),
                      });
                      
                      /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[background][persist] POST /messages response:", messagesRes.status, messagesRes.statusText);

                      if (!messagesRes.ok) {
                        const errorData = await messagesRes.json().catch(() => ({ error: "Failed to parse error response" }));
                        /* eslint-disable no-console */ log.error(LOG_CATEGORY, "[background][persist] Failed to save messages", {
                          status: messagesRes.status,
                          statusText: messagesRes.statusText,
                          error: errorData,
                          sessionId,
                          messageCount: backgroundMessages.length
                        });
                        return;
                      }
                      const messagesData = await messagesRes.json();
                      log.info(LOG_CATEGORY, "[background][persist] POST /messages data:", messagesData);
                      // Background summary is now generated server-side in the process pipeline.
                    } catch (err) {
                      /* eslint-disable no-console */ log.error(LOG_CATEGORY, "[background][persist] Error in persistence flow:", err);
                    }
                  })();
                } else {
                  /* eslint-disable no-console */ log.error(LOG_CATEGORY, "[background][persist] Missing required data", {
                    hasSessionId: !!sessionId,
                    hasUserId: !!userId
                  });
                }
              } else {
                /* eslint-disable no-console */ log.warn(LOG_CATEGORY, "[background][persist] No messages to persist");
              }
            } catch (persistError) {
              /* eslint-disable no-console */ log.error(LOG_CATEGORY, "[background][persist] Error persisting data:", persistError);
            }
            
            // Post the coding task directly without OpenAI transformation
            try {
              /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[coding][posting_task]", taskText);
            } catch {}
            // TODO: Only formatting initial task message for demo
            // Need to handle other message types and make this more generic
            const formattedTask = formatInitialTaskMessage(taskText);
            post(formattedTask, "ai");
            if (automaticMode && onCodingPromptReady) {
              try {
                onCodingPromptReady();
              } catch {}
            }
          } catch (error) {
            /* eslint-disable no-console */ log.error(LOG_CATEGORY, "[coding] Failed to send coding prompt:", error);
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
          /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[text][send]", text);
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
          /* eslint-disable no-console */ log.info(LOG_CATEGORY, 
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
          /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[coding] Setting pending for background followup");
          dispatch(setPendingReply({
            pending: true,
          }));
          
          // Ask for follow-up
          const im = store.getState().interview;
          if (!im.companyName) {
            throw new Error("Interview machine missing companyName");
          }
          const persona = buildOpenAIBackgroundPrompt(String(im.companyName), scriptRef.current?.experienceCategories);
          const follow = await askViaChatCompletion(persona, [
            {
              role: "assistant",
              content: "Ask one short follow-up about their project.",
            },
            { role: "user", content: text },
          ]);
          if (follow) {
            const stage = store.getState().interview.stage;
            if (stage === "coding") {
              /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[coding] Background followup discarded - already in coding");
              dispatch(setPendingReply({
                pending: true,
              }));
              try {
                /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[background][followup_dropped]", {
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
            /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[coding][user_message]", text);
          } catch {}
          
          // Check if we're in an active paste evaluation
          const codingState = store.getState().coding;
          const activePasteEval = codingState.activePasteEvaluation;
          
          // If paste eval exists but no question was ever posted, it's stuck - clear it
          if (activePasteEval && !activePasteEval.currentQuestion) {
            dispatch(clearPasteEvaluation());
            // Continue to normal coding chat flow
          } else if (activePasteEval) {
            // Handle paste evaluation flow with CONTROL messages
            // Increment answer count AFTER user answers
            const nextAnswerCount = activePasteEval.answerCount + 1;
            
            try {
              /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[paste_eval][user_answer]", { 
                id: activePasteEval.pasteEvaluationId,
                answerCount: nextAnswerCount,
                userText: text
              });
            } catch {}
            
            const codingPrompt = scriptRef.current?.codingPrompt;
            if (!codingPrompt) {
              /* eslint-disable no-console */ log.error(LOG_CATEGORY, "[paste_eval] Missing coding task");
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
              /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[paste_eval][conversation_extracted]", {
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
                  /* eslint-disable no-console */ log.info(LOG_CATEGORY, `[paste_eval][Q${nextAnswerCount}_score]`, questionScore);
                }
              } catch (e) {
                /* eslint-disable no-console */ log.error(LOG_CATEGORY, "[paste_eval] Failed to score Q&A:", e);
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
            // Use OpenAI's judgment of answer intent — not a hardcoded string match.
            // dont_know: candidate explicitly gave up / said pass / sent gibberish → exit early
            // clarification_request: candidate asked "what do you mean?" → stay in mode, post clarification
            // substantive: candidate engaged with the question → continue probing
            const detectedAnswerType = questionScore?.detectedAnswerType || "substantive";
            const candidateExplicitlyGaveUp = detectedAnswerType === "dont_know";
            const candidateAskedClarification = detectedAnswerType === "clarification_request";
            const shouldEvaluate = allTopicsMaximized || questionLimitReached || candidateExplicitlyGaveUp;
            
            // If evaluation complete, post static message and exit
            if (shouldEvaluate) {
              const exitMessage = "Thanks for explaining. Let's continue with your implementation.";
              post(exitMessage, "ai");  // No paste eval ID - normal styling
              
              // Clear only the editor highlighting, keep debug panel data visible
              if ((window as any).__clearPasteHighlight) {
                (window as any).__clearPasteHighlight();
              }
              
              try {
                /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[paste_eval][acknowledgment_sent]", {
                  text: exitMessage,
                  reason: allTopicsMaximized ? "all_topics_100" : questionLimitReached ? "question_limit" : "candidate_gave_up"
                });
              } catch {}
              
              clearPendingState();
            } else if (candidateAskedClarification) {
              // Candidate asked "what do you mean?" — stay in paste eval mode, post a rephrased question
              /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[paste_eval][clarification_requested] Generating rephrased question");
              dispatch(setPendingReply({ pending: true }));

              const clarificationPrompt = `You are helping a candidate understand a question about code they pasted in a coding interview.

The candidate did not understand the question and asked for clarification.

**Original question asked:** ${pasteConversation.filter(m => m.role === "assistant").slice(-1)[0]?.content || ""}
**Candidate's response:** ${text}
**Pasted code:** ${activePasteEval.pastedContent}

Rephrase the original question in a simpler, clearer way (1-2 sentences max). Be warm and encouraging. Do not ask a completely new question — just clarify what was already asked.`;

              const clarificationReply = await askViaChatCompletion(clarificationPrompt, []);
              if (clarificationReply) {
                post(clarificationReply, "ai", { isPasteEval: true, pasteEvaluationId: activePasteEval.pasteEvaluationId });
              }
              clearPendingState();
            } else {
              // Continue evaluation - generate next question from OpenAI
              // Set pending state before API call
              /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[coding] Setting pending for paste eval followup");
              dispatch(setPendingReply({
                pending: true,
              }));
              
              // Generate AI follow-up question
              const aiQuestion = await askViaChatCompletion(
                pasteEvalPrompt,
                historyMessages
              );
              
              if (!aiQuestion) {
                clearPendingState();
                setInputLocked?.(false);
                return;
              }
              
              try {
                /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[paste_eval][question]", aiQuestion);
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
              /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[paste_eval][score_calculation]", {
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
                /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[paste_eval][ready_to_evaluate]", {
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
                    /* eslint-disable no-console */ log.warn(LOG_CATEGORY, "[paste_eval] Summary API failed, using fallback");
                  }
                } catch (error) {
                  // Fallback on error
                  summary = `Candidate provided responses to ${questionScores.length} question(s).`;
                  /* eslint-disable no-console */ log.error(LOG_CATEGORY, "[paste_eval] Summary API error:", error);
                }

                const evaluation = {
                  understanding,
                  accountabilityScore: avgScore,
                  reasoning: summary,
                  caption: summary,
                };
                
                try {
                  /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[paste_eval][aggregated_evaluation]", {
                    questionCount: questionScores.length,
                    scores: questionScores.map(qs => qs.score),
                    avgScore,
                    evaluation
                  });
                } catch {}
                
                // Validation: ensure we have valid data before DB save
                if (questionScores.length === 0) {
                  /* eslint-disable no-console */ log.error(LOG_CATEGORY, "[paste_eval][validation_error] No questions were scored");
                  setInputLocked?.(false);
                  return;
                }
                
                if (!summary || summary.trim() === "") {
                  /* eslint-disable no-console */ log.error(LOG_CATEGORY, "[paste_eval][validation_error] Summary is empty");
                  // Use fallback summary
                  evaluation.reasoning = `Candidate provided responses to ${questionScores.length} question(s).`;
                  evaluation.caption = evaluation.reasoning;
                }
                
                if (evaluation) {
                  
                  try {
                    /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[paste_eval][evaluation_result]", evaluation);
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
                  
                  // Save to DB — use local ref for aiQuestionTimestamp (single-owner)
                  const sessionId = ms.sessionId;
                  const tsForDb = aiQuestionTimestampRef.current;
                  if (!tsForDb) {
                    log.error(LOG_CATEGORY, "[paste_eval] aiQuestionTimestampRef is null — skipping DB save");
                    setInputLocked?.(false);
                    return;
                  }
                  if (sessionId && !savedToDbRef.current && !savingRef.current) {
                    savingRef.current = true;
                    const dbPayload = {
                      timestamp: activePasteEval.timestamp,
                      pastedContent: activePasteEval.pastedContent,
                      characterCount: activePasteEval.pastedContent.length,
                      aiQuestion: aiQuestions || "",
                      aiQuestionTimestamp: tsForDb,
                      userAnswer: userAnswers || "",
                      understanding: evaluation.understanding,
                      accountabilityScore: evaluation.accountabilityScore,
                      reasoning: evaluation.reasoning,
                      caption: evaluation.caption,
                    };
                    
                    try {
                      /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[paste_eval][saving_to_db]", dbPayload);
                    } catch {}
                    
                    const dbResponse = await fetch(`/api/interviews/session/${sessionId}/external-tools`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(dbPayload),
                    });
                    
                    if (dbResponse.ok) {
                      savedToDbRef.current = true;
                      log.info(LOG_CATEGORY, "[paste_eval][saved_to_db]");
                    } else {
                      try {
                        const errorData = await dbResponse.json();
                        log.error(LOG_CATEGORY, "[paste_eval][db_error]", {
                          status: dbResponse.status,
                          error: errorData
                        });
                      } catch {}
                    }
                    savingRef.current = false;
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
            /* eslint-disable no-console */ log.error(LOG_CATEGORY, "[coding] Missing coding context from script");
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
          // Explicitly pass "coding" stage to ensure we read from codingSlice
          const historyMessages = buildControlContextMessages(CONTROL_CONTEXT_TURNS, "coding");
          
          // Set pending state before API call
          /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[coding] Setting pending for coding question");
          dispatch(setPendingReply({
            pending: true,
          }));
          
          // Generate AI response using chat completions
          const reply = await askViaChatCompletion(
            systemPrompt,
            historyMessages
          );
          
          if (reply) {
            post(reply, "ai");
            clearPendingState();
            setInputLocked?.(false);
            try {
              /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[coding][ai_response]", reply);
            } catch {}
          } else {
            clearPendingState();
            setInputLocked?.(false);
          }
          
          return;
        }
      },
      [clearPendingState, deliverAssistantPrompt, dispatch, setInputLocked, post, questionsLimit]
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
        /* eslint-disable no-console */ log.info(LOG_CATEGORY, "[OpenAITextConversation] Script loaded, ready for coding transition");
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
      flushPendingPasteEval,
    }));

    return null;
  }
);

OpenAITextConversation.displayName = "OpenAITextConversation";

export default OpenAITextConversation;