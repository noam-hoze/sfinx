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
import { addMessage } from "@/shared/state/slices/interviewChatSlice";
import { store } from "@/shared/state/store";
import {
  setExpectedBackgroundQuestion,
  start as machineStart,
  aiFinal as machineAiFinal,
  userFinal as machineUserFinal,
} from "@/shared/state/slices/interviewMachineSlice";
import {
  buildOpenAIBackgroundPrompt,
  buildOpenAICodingPrompt,
  buildOpenAIInterviewerPrompt,
} from "@/shared/prompts/openAIInterviewerPrompt";
import { interviewChatStore } from "@/shared/state/interviewChatStore";
import { stopCheck } from "@/shared/services/weightedMean/scorer";
import {
  askViaChatCompletion,
  buildClosingInstruction,
  generateAssistantReply,
  runBackgroundControl,
} from "./openAITextConversationHelpers";
import {
  buildControlContextMessages,
  CONTROL_CONTEXT_TURNS,
} from "../../../../shared/services";

// Paste evaluation constants
const MAX_PASTE_EVAL_ANSWERS = 3;
const MIN_CONFIDENCE_TO_EVALUATE = 70;

type Props = {
  candidateName: string;
  onStartConversation?: () => void;
  automaticMode?: boolean;
  onCodingPromptReady?: () => void;
  onGreetingDelivered?: () => void;
  onInterviewConcluded?: (delayMs?: number) => void;
  setInputLocked?: (locked: boolean) => void;
  onPasteDetected?: (pastedCode: string) => void;
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
    interviewSessionId,
  }, ref) => {
    if (!candidateName) {
      throw new Error("OpenAITextConversation requires a candidateName");
    }
    const searchParams = useSearchParams();
    const isDemoMode = searchParams.get("demo") === "true";
    const demoUserId = searchParams.get("userId");
    
    const dispatch = useDispatch();
    const openAIApiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    if (!openAIApiKey) {
      throw new Error("NEXT_PUBLIC_OPENAI_API_KEY is required");
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
        dispatch(addMessage({ text, speaker }));
        try {
          interviewChatStore.dispatch({
            type: "ADD_MESSAGE",
            payload: { 
              text, 
              speaker, 
              isPasteEval: metadata?.isPasteEval,
              pasteEvaluationId: metadata?.pasteEvaluationId,
            },
          } as any);
        } catch {}
      },
      [dispatch]
    );

    const clearPendingState = useCallback(() => {
      interviewChatStore.dispatch({
        type: "SET_PENDING_REPLY",
        payload: { pending: false },
      } as any);
    }, []);

    const clearPendingAndThrow = useCallback(
      (message: string): never => {
        clearPendingState();
        throw new Error(message);
      },
      [clearPendingState]
    );

    const cancelPendingBackgroundReply = useCallback(() => {
      const pendingContext = interviewChatStore.getState().pendingReplyContext;
      if (!pendingContext) return;
      try {
        /* eslint-disable no-console */ console.log("[coding][pending_cancelled]", pendingContext);
      } catch {}
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
        const stageSnapshot = interviewChatStore.getState().stage;
        if (pendingReason) {
          interviewChatStore.dispatch({
            type: "SET_PENDING_REPLY",
            payload: { pending: true, reason: pendingReason, stage: stageSnapshot },
          } as any);
        }
        try {
        const answer = await generateAssistantReply(openaiClient, persona, instruction);
        if (!answer) {
          if (pendingReason && !managePending) {
            interviewChatStore.dispatch({
              type: "SET_PENDING_REPLY",
              payload: { pending: false },
            } as any);
          }
          return null;
        }
          if (autoPost) {
          const machineState = store.getState().interviewMachine.state;
          if (
            machineState === "in_coding_session" &&
            pendingReason &&
            pendingReason.startsWith("background")
          ) {
            try {
              /* eslint-disable no-console */ console.log("[background][answer_dropped]", {
                pendingReason,
                stage: machineState,
              });
            } catch {}
            interviewChatStore.dispatch({
              type: "SET_PENDING_REPLY",
              payload: {
                pending: true,
                reason: `${pendingReason}_discarded`,
                stage: machineState,
              },
            } as any);
            return answer;
          }
        post(answer, "ai");
        dispatch(machineAiFinal({ text: answer }));
          // Unlock input when AI responds
          setInputLocked?.(false);
          }
          if (pendingReason && !managePending) {
            interviewChatStore.dispatch({
              type: "SET_PENDING_REPLY",
              payload: { pending: false },
            } as any);
          }
          if (autoPost && onGreetingDelivered && instruction.includes("I'll be the one interviewing today!")) {
          try {
            onGreetingDelivered();
          } catch {}
        }
        return answer;
        } catch (error) {
          if (pendingReason && !managePending) {
            interviewChatStore.dispatch({
              type: "SET_PENDING_REPLY",
              payload: { pending: false },
            } as any);
          }
          throw error;
        }
      },
      [dispatch, onGreetingDelivered, setInputLocked, openaiClient, post]
    );

    /** Handle paste detection during coding stage - Start evaluation flow */
    const handlePasteDetected = useCallback(
      async (pastedCode: string, timestamp: number) => {
        const ms = store.getState().interviewMachine;
        if (ms.state !== "in_coding_session") return;
        
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
            const chapterUrl = isDemoMode
              ? `/api/interviews/session/${interviewSessionId}/paste-chapter?skip-auth=true`
              : `/api/interviews/session/${interviewSessionId}/paste-chapter`;
            
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
        
        // Update debug panel - start evaluation
        interviewChatStore.dispatch({
          type: "CODING_START_PASTE_EVAL",
          payload: {
            pasteEvaluationId,
            pastedContent: pastedCode,
            timestamp,
            videoChapterId,
          },
        } as any);
        
        // Get coding context
        const codingPrompt = scriptRef.current?.codingPrompt;
        
        if (!codingPrompt) {
          /* eslint-disable no-console */ console.error("[paste_eval] Missing coding task");
          return;
        }
        
        // Build initial question prompt (no CONTROL needed for first question)
        const initialPrompt = `You are a technical interviewer. A candidate just pasted this code:

${pastedCode}

The coding task they're working on: ${codingPrompt}

Ask ONE short, relevant question (1-2 sentences) to understand if they comprehend what they pasted. Don't evaluate yet, just ask.`;
        
        // Generate AI question with EMPTY history (fresh conversation about this paste)
        const question = await askViaChatCompletion(
          openaiClient,
          initialPrompt,
          []  // No history - focus only on the pasted code
        );
        
        if (question) {
          const aiQuestionTimestamp = Date.now();
          post(question, "ai", { isPasteEval: true, pasteEvaluationId });
          dispatch(machineAiFinal({ text: question }));
          
          // Update debug panel with question (answerCount still 0 - no answers yet)
          interviewChatStore.dispatch({
            type: "CODING_UPDATE_PASTE_EVAL",
            payload: {
              confidence: 0,
              answerCount: 0,
              readyToEvaluate: false,
              currentQuestion: question,
              aiQuestionTimestamp,
            },
          } as any);
          
          try {
            /* eslint-disable no-console */ console.log("[paste_eval][question_asked]", { pasteEvaluationId, question });
          } catch {}
        }
      },
      [dispatch, openaiClient, post, interviewSessionId, isDemoMode]
    );

    /** Injects the coding prompt once the guard advances into the coding session. */
    useEffect(() => {
      const unsubscribe = store.subscribe(() => {
        const ms = store.getState().interviewMachine;
        if (ms.state !== "in_coding_session" || codingPromptSentRef.current) return;
        codingPromptSentRef.current = true;
        
        // Update interviewChatStore stage to "coding" so debug panel reflects it
        interviewChatStore.dispatch({ type: "SET_STAGE", payload: "coding" } as any);
        
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
            const chatSnapshot = interviewChatStore.getState();
            const hadPending = chatSnapshot.pendingReply;
            if (hadPending) {
              cancelPendingBackgroundReply();
            }
            const reason = chatSnapshot.background?.reason;
            
            // Persist background messages and trigger summary generation (fire-and-forget)
            // Note: Session ID needs to be passed from parent component or obtained from URL/context
            try {
              /* eslint-disable no-console */ console.log("[background][persist] Starting persistence flow");
              const backgroundMessages = chatSnapshot.messages.filter((msg) => {
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
                      const url = isDemoMode
                        ? `/api/interviews/session/${sessionId}/messages?skip-auth=true`
                        : `/api/interviews/session/${sessionId}/messages`;
                      
                      const body: Record<string, any> = { messages: backgroundMessages };
                      if (isDemoMode && demoUserId) {
                        body.userId = demoUserId;
                      }
                      
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
                      const scorer = chatSnapshot.background?.scorer;
                      /* eslint-disable no-console */ console.log("[background][persist] scorer:", scorer);
                      
                      if (scorer) {
                        const summaryUrl = isDemoMode
                          ? `/api/interviews/session/${sessionId}/background-summary?skip-auth=true`
                          : `/api/interviews/session/${sessionId}/background-summary`;
                        
                        const summaryPayload: Record<string, any> = {
                          scores: {
                            adaptability: Math.round((scorer.A?.S ?? 0) * 100),
                            creativity: Math.round((scorer.C?.S ?? 0) * 100),
                            reasoning: Math.round((scorer.R?.S ?? 0) * 100),
                          },
                          rationales: chatSnapshot.background?.rationales,
                          companyName: ms.companyName,
                          roleName: ms.roleSlug?.replace(/-/g, " "),
                        };
                        
                        if (isDemoMode && demoUserId) {
                          summaryPayload.userId = demoUserId;
                        }
                        
                        /* eslint-disable no-console */ console.log("[background][persist] Calling POST /background-summary with payload:", summaryPayload);
                        
                        const summaryRes = await fetch(summaryUrl, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(summaryPayload),
                        });
                        
                        /* eslint-disable no-console */ console.log("[background][persist] POST /background-summary response:", summaryRes.status, summaryRes.statusText);
                        const summaryData = await summaryRes.json();
                        /* eslint-disable no-console */ console.log("[background][persist] POST /background-summary data:", summaryData);
                      } else {
                        /* eslint-disable no-console */ console.warn("[background][persist] No scorer found, skipping summary generation");
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
            
            // No transition preface needed - interview page starts directly in coding mode
            const expectedMessage = taskText;
            codingExpectedMessageRef.current = expectedMessage;
            const instruction = hadPending
              ? `System note (do not say to candidate): Previous background reply was skipped because we transitioned to coding.\n\nSay exactly:\n"""\n${expectedMessage}\n"""`
              : `Say exactly:\n"""\n${expectedMessage}\n"""`;
            try {
              /* eslint-disable no-console */ console.log("[coding][instruction]", expectedMessage);
            } catch {}
            const answer = await deliverAssistantPrompt({
              persona,
              instruction,
              pendingReason: "coding_prompt",
              autoPost: false,
              managePending: true,
            });
            if (answer !== null) {
              try {
                /* eslint-disable no-console */ console.log("[coding][answer]", answer);
              } catch {}
            }
            if (answer == null || answer === "") {
              clearPendingAndThrow("OpenAI returned empty coding prompt response");
            }
            const finalAnswer = answer!;
            post(finalAnswer, "ai");
            dispatch(machineAiFinal({ text: finalAnswer }));
            interviewChatStore.dispatch({
              type: "SET_PENDING_REPLY",
              payload: { pending: false },
            } as any);
            if (automaticMode && onCodingPromptReady) {
            try {
              onCodingPromptReady();
            } catch {}
            }
          } catch (error) {
            interviewChatStore.dispatch({
              type: "SET_PENDING_REPLY",
              payload: { pending: false },
            } as any);
            codingExpectedMessageRef.current = null;
            throw error;
          } finally {
            codingExpectedMessageRef.current = null;
          }
        })();
      });
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
        const chatState = interviewChatStore.getState();
        const activePasteEval = chatState.coding?.activePasteEvaluation;
        const isPasteEvalActive = !!activePasteEval;
        
        post(text, "user", { 
          isPasteEval: isPasteEvalActive,
          pasteEvaluationId: activePasteEval?.pasteEvaluationId,
        });
        // Lock input when user sends message
        setInputLocked?.(true);
        dispatch(machineUserFinal());
        try {
          /* eslint-disable no-console */ console.log(
            "[text][after userFinal]",
            { state: store.getState().interviewMachine.state }
          );
        } catch {}

        const ms = store.getState().interviewMachine;
        if (ms.state === "greeting_responded_by_user") {
          const expectedQ = scriptRef.current?.backgroundQuestion;
          if (expectedQ) {
            const persona = buildOpenAIBackgroundPrompt(
              String(ms.companyName || "Company")
            );
            const instruction = `Ask exactly: "${String(expectedQ)}"`;
            const reply = await deliverAssistantPrompt({
              persona,
              instruction,
              pendingReason: "background_question",
            });
            if (reply) {
              interviewChatStore.dispatch({
                type: "SET_STAGE",
                payload: "background",
              } as any);
            }
            return;
          }
        }

        if (ms.state === "background_answered_by_user") {
          // Set pending state BEFORE control run
          const pendingStage = interviewChatStore.getState().stage;
          interviewChatStore.dispatch({
            type: "SET_PENDING_REPLY",
            payload: {
              pending: true,
              reason: "background_followup",
              stage: pendingStage,
            },
          } as any);
          // Run CONTROL
          await runBackgroundControl(openaiClient);
          
          // Check if gate is satisfied immediately (same logic as machine slice)
          const chatState = interviewChatStore.getState();
          const scorer = chatState.background?.scorer;
          const coverage = chatState.background?.coverage;
          const gateReady = !!(scorer && coverage && stopCheck(scorer, coverage));
          
          try {
            /* eslint-disable no-console */ console.log("[background][after_control_check]", {
              gateReady,
              scorer: !!scorer,
              coverage,
            });
          } catch {}
          
          if (gateReady) {
            // Gate satisfied - skip follow-up entirely
            clearPendingState();
            try {
              /* eslint-disable no-console */ console.log("[background][gate_satisfied_skip_followup]", {
                machineStateBefore: store.getState().interviewMachine.state,
              });
            } catch {}
            // Trigger machine to evaluate guard by dispatching aiFinal (simulating AI response)
            dispatch(machineAiFinal({ text: "" }));
            try {
              /* eslint-disable no-console */ console.log("[background][dispatched_aiFinal_to_trigger_guard]", {
                machineStateAfter: store.getState().interviewMachine.state,
              });
            } catch {}
            return;
          }
          
          // Ask for follow-up
          const im = store.getState().interviewMachine;
          if (!im.companyName) {
            throw new Error("Interview machine missing companyName");
          }
          const persona = buildOpenAIBackgroundPrompt(String(im.companyName));
          const follow = await askViaChatCompletion(openaiClient, persona, [
            {
              role: "assistant",
              content: "Ask one short follow-up about their project.",
            },
            { role: "user", content: text },
          ]);
          if (follow) {
            const machineState = store.getState().interviewMachine.state;
            if (machineState === "in_coding_session") {
              interviewChatStore.dispatch({
                type: "SET_PENDING_REPLY",
                payload: {
                  pending: true,
                  reason: "background_followup_discarded",
                  stage: machineState,
                },
              } as any);
              try {
                /* eslint-disable no-console */ console.log("[background][followup_dropped]", {
                  follow,
                  machineState,
                });
              } catch {}
              return;
            }
            post(follow, "ai");
            dispatch(machineAiFinal({ text: follow }));
            // Unlock input when AI responds
            setInputLocked?.(false);
            clearPendingState();
          } else {
            clearPendingState();
          }
          return;
        }

        // Handle coding stage messages
        if (ms.state === "in_coding_session") {
          try {
            /* eslint-disable no-console */ console.log("[coding][user_message]", text);
          } catch {}
          
          // Check if we're in an active paste evaluation
          const chatState = interviewChatStore.getState();
          const activePasteEval = chatState.coding?.activePasteEvaluation;
          
          if (activePasteEval) {
            // Handle paste evaluation flow with CONTROL messages
            // Increment answer count AFTER user answers
            const nextAnswerCount = activePasteEval.answerCount + 1;
            
            try {
              /* eslint-disable no-console */ console.log("[paste_eval][user_answer]", { 
                id: activePasteEval.pasteEvaluationId,
                answerCount: nextAnswerCount 
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
            const rawMessages = interviewChatStore.getState().messages;
            
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
            
            const pasteEvalPrompt = `CRITICAL: YOU MUST START YOUR RESPONSE WITH A CONTROL LINE IN THIS EXACT FORMAT:
CONTROL: {"type":"PASTE_EVAL_CONTROL","pasteEvaluationId":"${activePasteEval.pasteEvaluationId}","confidence":0-100,"answerCount":${nextAnswerCount},"readyToEvaluate":true/false}

After the CONTROL line, add your conversational response to the candidate.

---

You are evaluating whether a candidate understands code they pasted.

**Context:**
- Pasted code: ${activePasteEval.pastedContent}
- Task: ${codingPrompt}
- Conversation: ${conversationHistory || "Just started"}
- User answers: ${nextAnswerCount}/${MAX_PASTE_EVAL_ANSWERS}

**Your Job:**
1. Evaluate their understanding (confidence 0-100)
2. If confidence < ${MIN_CONFIDENCE_TO_EVALUATE}% AND answerCount < ${MAX_PASTE_EVAL_ANSWERS}: Ask ONE short follow-up question (1-2 sentences)
3. If confidence >= ${MIN_CONFIDENCE_TO_EVALUATE}% OR answerCount >= ${MAX_PASTE_EVAL_ANSWERS}: Set readyToEvaluate=true AND send a brief acknowledgment like "Thank you for explaining. Let's continue with the task."

**CRITICAL: If answerCount = ${MAX_PASTE_EVAL_ANSWERS}, you MUST:**
- Set readyToEvaluate=true
- Send ONLY an acknowledgment message (NOT another question)
- Example: "Thank you for explaining. Let's continue with the task."

**Example Responses:**

Continue (answerCount < ${MAX_PASTE_EVAL_ANSWERS}, confidence < ${MIN_CONFIDENCE_TO_EVALUATE}%):
CONTROL: {"type":"PASTE_EVAL_CONTROL","pasteEvaluationId":"${activePasteEval.pasteEvaluationId}","confidence":45,"answerCount":${nextAnswerCount},"readyToEvaluate":false}
Could you explain how the useEffect hook works here?

Done (answerCount = ${MAX_PASTE_EVAL_ANSWERS} OR confidence >= ${MIN_CONFIDENCE_TO_EVALUATE}%):
CONTROL: {"type":"PASTE_EVAL_CONTROL","pasteEvaluationId":"${activePasteEval.pasteEvaluationId}","confidence":75,"answerCount":${nextAnswerCount},"readyToEvaluate":true}
Thank you for explaining. Let's continue with the task.

REMEMBER: ALWAYS start with CONTROL line first!`;
            
            // Get conversation history (only messages AFTER paste)
            const historyMessages = pasteConversation;
            
            // Set pending state before API call
            interviewChatStore.dispatch({
              type: "SET_PENDING_REPLY",
              payload: { pending: true, reason: "paste_eval_followup", stage: "coding" },
            } as any);
            
            // Generate AI response with CONTROL
            const fullResponse = await askViaChatCompletion(
              openaiClient,
              pasteEvalPrompt,
              historyMessages
            );
            
            if (!fullResponse) {
              clearPendingState();
              setInputLocked?.(false);
              return;
            }
            
            try {
              /* eslint-disable no-console */ console.log("[paste_eval][raw_response]", fullResponse);
            } catch {}
            
            // Parse CONTROL message
            let aiText = fullResponse;
            let control: any = null;
            
            const controlMatch = fullResponse.match(/CONTROL:\s*(\{[\s\S]*?\})/);
            
            try {
              /* eslint-disable no-console */ console.log("[paste_eval][controlMatch]", controlMatch ? "FOUND" : "NOT FOUND");
            } catch {}
            
            if (controlMatch) {
              try {
                control = JSON.parse(controlMatch[1]);
                aiText = fullResponse.replace(/CONTROL:\s*\{[\s\S]*?\}\s*\n?/, "").trim();
                
                try {
                  /* eslint-disable no-console */ console.log("[paste_eval][control]", control);
                } catch {}
              } catch (e) {
                /* eslint-disable no-console */ console.error("[paste_eval] Failed to parse CONTROL:", e);
              }
            }
            
            // Force evaluation if we've reached max answers
            const shouldEvaluate = (control && control.readyToEvaluate) || nextAnswerCount >= MAX_PASTE_EVAL_ANSWERS;
            
            // Check if AI violated the 3-answer limit (asked a question when it should have acknowledged)
            const aiViolatedLimit = nextAnswerCount >= MAX_PASTE_EVAL_ANSWERS && !shouldEvaluate;
            
            if (aiViolatedLimit) {
              // DROP the message - don't show it to user
              try {
                /* eslint-disable no-console */ console.log("[paste_eval][message_dropped]", {
                  reason: "violated_3_answer_limit",
                  droppedMessage: aiText,
                  nextAnswerCount
                });
              } catch {}
              
              // Send system correction to OpenAI
              const correctionPrompt = `SYSTEM CORRECTION: Your last message was dropped because you violated the 3-answer limit for paste evaluation. You asked a 4th question when you should have acknowledged and ended the evaluation. Respond ONLY with "Got it!" to acknowledge.`;
              
              const acknowledgment = await askViaChatCompletion(
                openaiClient,
                correctionPrompt,
                []  // No history needed for this correction
              );
              
              if (acknowledgment) {
                post(acknowledgment, "ai", { isPasteEval: true, pasteEvaluationId: activePasteEval.pasteEvaluationId });
                dispatch(machineAiFinal({ text: acknowledgment }));
                
                try {
                  /* eslint-disable no-console */ console.log("[paste_eval][correction_acknowledged]", acknowledgment);
                } catch {}
              }
              
              clearPendingState();
              
              // Force evaluation now with the paste conversation history
              const ms = store.getState().interviewMachine;
              
              // Update state for forced evaluation
              interviewChatStore.dispatch({
                type: "CODING_UPDATE_PASTE_EVAL",
                payload: {
                  confidence: 0,  // Low confidence since AI misbehaved
                  answerCount: nextAnswerCount,
                  readyToEvaluate: true,
                  currentQuestion: acknowledgment,
                },
              } as any);
              
              // Combine conversation for final evaluation
              const userAnswers = pasteConversation
                .filter(m => m.role === "user")
                .map(m => m.content)
                .join(" ");
              const aiQuestions = pasteConversation
                .filter(m => m.role === "assistant")
                .map(m => m.content)
                .join(" ");
              
              // Call evaluation API
              const evalPayload = {
                pastedContent: activePasteEval.pastedContent,
                aiQuestion: aiQuestions,
                userAnswer: userAnswers,
                codingTask: codingPrompt,
              };
              
              const evalResponse = await fetch("/api/interviews/evaluate-paste-accountability", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(evalPayload),
              });
              
              if (evalResponse.ok) {
                const evaluation = await evalResponse.json();
                
                // Update debug panel with final evaluation
                interviewChatStore.dispatch({
                  type: "CODING_UPDATE_PASTE_EVAL",
                  payload: {
                    confidence: 0,
                    answerCount: nextAnswerCount,
                    readyToEvaluate: true,
                    currentQuestion: acknowledgment,
                    evaluationReasoning: evaluation.reasoning,
                    evaluationCaption: evaluation.caption,
                    accountabilityScore: evaluation.accountabilityScore,
                  },
                } as any);
                
                // Save to DB
                const sessionId = ms.sessionId;
                if (sessionId && activePasteEval.aiQuestionTimestamp) {
                  const dbPayload = {
                    timestamp: activePasteEval.timestamp,
                    pastedContent: activePasteEval.pastedContent,
                    characterCount: activePasteEval.pastedContent.length,
                    aiQuestion: aiQuestions,
                    aiQuestionTimestamp: activePasteEval.aiQuestionTimestamp,
                    userAnswer: userAnswers,
                    userAnswerTimestamp: Date.now(),
                    understanding: evaluation.understanding,
                    accountabilityScore: evaluation.accountabilityScore,
                    reasoning: evaluation.reasoning,
                    caption: evaluation.caption,
                  };
                  
                  await fetch(`/api/interviews/session/${sessionId}/external-tools`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(dbPayload),
                  });
                  
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
                }
              }
              
              // Don't clear paste evaluation - keep it visible in debug panel
              
              setInputLocked?.(false);
              return;
            }
            
            // Post AI response (either follow-up question or acknowledgment)
            if (aiText) {
              post(aiText, "ai", { isPasteEval: true, pasteEvaluationId: activePasteEval.pasteEvaluationId });
              dispatch(machineAiFinal({ text: aiText }));
              clearPendingState();
              
              if (shouldEvaluate) {
                try {
                  /* eslint-disable no-console */ console.log("[paste_eval][acknowledgment_sent]", {
                    text: aiText,
                    reason: "evaluation_complete"
                  });
                } catch {}
              }
            }
            
            if (shouldEvaluate) {
                try {
                  /* eslint-disable no-console */ console.log("[paste_eval][triggering_evaluation]", { 
                    nextAnswerCount, 
                    controlReady: control?.readyToEvaluate,
                    forced: nextAnswerCount >= MAX_PASTE_EVAL_ANSWERS
                  });
                } catch {}
            }
            
            // Update debug panel with confidence (use our calculated answer count, not OpenAI's)
            if (control) {
              const userAnswerTimestamp = Date.now();
              interviewChatStore.dispatch({
                type: "CODING_UPDATE_PASTE_EVAL",
                payload: {
                  confidence: control.confidence ?? 0,
                  answerCount: nextAnswerCount,
                  readyToEvaluate: shouldEvaluate,
                  currentQuestion: !shouldEvaluate ? aiText : undefined,
                  userAnswerTimestamp,
                },
              } as any);
              
              // If ready to evaluate, trigger final evaluation
              if (shouldEvaluate) {
                try {
                  /* eslint-disable no-console */ console.log("[paste_eval][ready_to_evaluate]", {
                    id: activePasteEval.pasteEvaluationId,
                    confidence: control.confidence,
                  });
                } catch {}
                
                // Combine conversation for final evaluation (only paste conversation)
                const userAnswers = pasteConversation
                  .filter(m => m.role === "user")
                  .map(m => m.content)
                  .join(" ");
                const aiQuestions = pasteConversation
                  .filter(m => m.role === "assistant")
                  .map(m => m.content)
                  .join(" ");
                
                // Call evaluation API
                const evalPayload = {
                  pastedContent: activePasteEval.pastedContent,
                  aiQuestion: aiQuestions,
                  userAnswer: userAnswers,
                  codingTask: codingPrompt,
                };
                
                try {
                  /* eslint-disable no-console */ console.log("[paste_eval][eval_payload]", {
                    ...evalPayload,
                    aiQuestion_length: aiQuestions.length,
                    userAnswer_length: userAnswers.length,
                    pasteConversation_count: pasteConversation.length
                  });
                } catch {}
                
                const evalResponse = await fetch("/api/interviews/evaluate-paste-accountability", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(evalPayload),
                });
                
                if (evalResponse.ok) {
                  const evaluation = await evalResponse.json();
                  
                  try {
                    /* eslint-disable no-console */ console.log("[paste_eval][evaluation_result]", evaluation);
                  } catch {}
                  
                  // Update debug panel with final evaluation
                  interviewChatStore.dispatch({
                    type: "CODING_UPDATE_PASTE_EVAL",
                    payload: {
                      confidence: control.confidence ?? 0,
                      answerCount: nextAnswerCount,
                      readyToEvaluate: true,
                      currentQuestion: aiText,
                      evaluationReasoning: evaluation.reasoning,
                      evaluationCaption: evaluation.caption,
                      accountabilityScore: evaluation.accountabilityScore,
                    },
                  } as any);
                  
                  // Save to DB
                  const sessionId = ms.sessionId;
                  if (sessionId && activePasteEval.aiQuestionTimestamp && activePasteEval.userAnswerTimestamp) {
                    const dbPayload = {
                      timestamp: activePasteEval.timestamp,
                      pastedContent: activePasteEval.pastedContent,
                      characterCount: activePasteEval.pastedContent.length,
                      aiQuestion: aiQuestions,
                      aiQuestionTimestamp: activePasteEval.aiQuestionTimestamp,
                      userAnswer: userAnswers,
                      userAnswerTimestamp: activePasteEval.userAnswerTimestamp,
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
                        hasAiTimestamp: !!activePasteEval.aiQuestionTimestamp,
                        hasUserTimestamp: !!activePasteEval.userAnswerTimestamp
                      });
                    } catch {}
                  }
                } else {
                  // Evaluation API returned error
                  try {
                    const errorData = await evalResponse.json();
                    /* eslint-disable no-console */ console.error("[paste_eval][eval_api_error]", {
                      status: evalResponse.status,
                      error: errorData
                    });
                  } catch (e) {
                    /* eslint-disable no-console */ console.error("[paste_eval][eval_api_error]", {
                      status: evalResponse.status,
                      message: "Could not parse error response"
                    });
                  }
                }
                
                // Don't clear paste evaluation - keep it visible in debug panel
              }
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
          interviewChatStore.dispatch({
            type: "SET_PENDING_REPLY",
            payload: { pending: true, reason: "coding_question", stage: "coding" },
          } as any);
          
          // Generate AI response using chat completions
          const reply = await askViaChatCompletion(
            openaiClient,
            systemPrompt,
            historyMessages
          );
          
          if (reply) {
            post(reply, "ai");
            dispatch(machineAiFinal({ text: reply }));
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
      [clearPendingState, deliverAssistantPrompt, dispatch, setInputLocked, openaiClient, post]
    );

    const startConversation = useCallback(async () => {
      if (readyRef.current) return;
      readyRef.current = true;
      const ms = store.getState().interviewMachine;
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
      if (data?.backgroundQuestion)
        dispatch(
          setExpectedBackgroundQuestion({
            question: String(data.backgroundQuestion),
          })
        );
      
      // Interview page: No greeting, no state machine start
      // State machine will be forced to coding by InterviewIDE after this completes
      try {
        /* eslint-disable no-console */ console.log("[OpenAITextConversation] Script loaded, ready for coding transition");
      } catch {}
      
      try {
        onStartConversation?.();
      } catch {}
    }, [dispatch, onStartConversation]);

    const sayClosingLine = useCallback(
      async (name?: string) => {
        const candidate = typeof name === "string" && name.trim().length > 0 ? name.trim() : candidateName;
        
        // WORKAROUND: Post closing message directly instead of asking OpenAI to generate it.
        // OpenAI sometimes refuses to follow the exact instruction (responding with "I'm unable to...") 
        // or corrupts the output. Since this is the final message and must be consistent for all 
        // candidates, we bypass AI generation and post the exact scripted message directly.
        const closingMessage = `Thank you so much ${candidate}, the next steps will be shared with you shortly.`;
        post(closingMessage, "ai");
        dispatch(machineAiFinal({ text: closingMessage }));
        
        try {
          onInterviewConcluded?.(2700);
        } catch {}
      },
      [candidateName, post, dispatch, onInterviewConcluded]
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