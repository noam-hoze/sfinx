"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
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
import {
  askViaChatCompletion,
  buildClosingInstruction,
  generateAssistantReply,
  runBackgroundControl,
} from "./openAITextConversationHelpers";

type Props = {
  candidateName: string;
  onStartConversation?: () => void;
  automaticMode?: boolean;
  onCodingPromptReady?: () => void;
  onGreetingDelivered?: () => void;
  onInterviewConcluded?: (delayMs?: number) => void;
};

const OpenAITextConversation = forwardRef<any, Props>(
  ({
    candidateName,
    onStartConversation,
    automaticMode = false,
    onCodingPromptReady,
    onGreetingDelivered,
    onInterviewConcluded,
  }, ref) => {
    if (!candidateName) {
      throw new Error("OpenAITextConversation requires a candidateName");
    }
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
      (text: string, speaker: "user" | "ai") => {
        if (!text) return;
        dispatch(addMessage({ text, speaker }));
        try {
          interviewChatStore.dispatch({
            type: "ADD_MESSAGE",
            payload: { text, speaker },
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
      [dispatch, onGreetingDelivered, openaiClient, post]
    );

    /** Injects the coding prompt once the guard advances into the coding session. */
    useEffect(() => {
      const unsubscribe = store.subscribe(() => {
        const ms = store.getState().interviewMachine;
        if (ms.state !== "in_coding_session" || codingPromptSentRef.current) return;
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
            const chatSnapshot = interviewChatStore.getState();
            const hadPending = chatSnapshot.pendingReply;
            if (hadPending) {
              cancelPendingBackgroundReply();
            }
            const reason = chatSnapshot.background?.reason;
            let preface = "Well, actually we will have to move on to next section which is our coding challenge.";
            if (reason === "useless_answers") {
              preface = "OK, let's move on to the coding question.";
            } else if (reason === "gate") {
              preface = "Great, let's move on to the coding question.";
            }
            const expectedMessage = `${preface} ${taskText}`;
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
        post(text, "user");
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
          // Run CONTROL and then ask a short follow-up
          await runBackgroundControl(openaiClient);
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
            clearPendingState();
          } else {
            clearPendingState();
          }
          return;
        }
      },
      [clearPendingState, deliverAssistantPrompt, dispatch, openaiClient, post]
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
      const name = candidateName;
      dispatch(machineStart({ candidateName: name }));
      const companyName = store.getState().interviewMachine.companyName;
      if (!companyName) {
        throw new Error("Interview machine missing companyName");
      }
      const persona = buildOpenAIInterviewerPrompt(companyName);
      const instruction = `Say exactly: "Hi ${name}, I'm Carrie. I'll be the one interviewing today!"`;
      const greeting = await deliverAssistantPrompt({
        persona,
        instruction,
        pendingReason: "greeting",
      });
      if (!greeting) {
        const fallback = `Hi ${name}, I'm Carrie. I'll be the one interviewing today!`;
        post(fallback, "ai");
        dispatch(machineAiFinal({ text: fallback }));
        try {
          onGreetingDelivered?.();
        } catch {}
      }
      try {
        onStartConversation?.();
      } catch {}
    }, [candidateName, deliverAssistantPrompt, dispatch, onGreetingDelivered, onStartConversation, post]);

    const sayClosingLine = useCallback(
      async (name?: string) => {
        const candidate = typeof name === "string" && name.trim().length > 0 ? name.trim() : candidateName;
        const companyName = store.getState().interviewMachine.companyName;
        if (!companyName) {
          throw new Error("Interview machine missing companyName for closing line");
        }
        const persona = buildOpenAIInterviewerPrompt(companyName);
        const instruction = buildClosingInstruction(candidate);
        const answer = await deliverAssistantPrompt({
          persona,
          instruction,
          pendingReason: "closing_line",
        });
        if (answer) {
          try {
            onInterviewConcluded?.(2700);
          } catch {}
        }
      },
      [candidateName, deliverAssistantPrompt, onInterviewConcluded]
    );

    useImperativeHandle(ref, () => ({
      startConversation,
      sendUserMessage,
      sayClosingLine,
    }));

    return null;
  }
);

OpenAITextConversation.displayName = "OpenAITextConversation";

export default OpenAITextConversation;