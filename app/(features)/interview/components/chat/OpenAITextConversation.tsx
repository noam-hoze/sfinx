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
  generateAssistantReply,
  runBackgroundControl,
} from "./openAITextConversationHelpers";

type Props = { candidateName: string; onStartConversation?: () => void };

const OpenAITextConversation = forwardRef<any, Props>(
  ({ candidateName, onStartConversation }, ref) => {
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

    const deliverAssistantPrompt = useCallback(
      async ({ persona, instruction }: { persona: string; instruction: string }) => {
        const answer = await generateAssistantReply(openaiClient, persona, instruction);
        if (!answer) return null;
        post(answer, "ai");
        dispatch(machineAiFinal({ text: answer }));
        return answer;
      },
      [dispatch, openaiClient, post]
    );

    /** Injects the coding prompt once the guard advances into the coding session. */
    useEffect(() => {
      const unsubscribe = store.subscribe(() => {
        const ms = store.getState().interviewMachine;
        if (ms.state !== "in_coding_session" || codingPromptSentRef.current) return;
        codingPromptSentRef.current = true;
        try {
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
            /* eslint-disable no-console */ console.log("[coding][instruction]", taskText);
          } catch {}
          const instruction = `Ask exactly:\n"""\n${taskText}\n"""`;
          void deliverAssistantPrompt({ persona, instruction }).catch(() => {
            codingPromptSentRef.current = false;
          });
        } catch (error) {
          codingPromptSentRef.current = false;
          throw error;
        }
      });
      return () => unsubscribe();
    }, [deliverAssistantPrompt]);

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
            const reply = await deliverAssistantPrompt({ persona, instruction });
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
            post(follow, "ai");
            dispatch(machineAiFinal({ text: follow }));
          }
          return;
        }
      },
      [deliverAssistantPrompt, dispatch, openaiClient, post]
    );

    const startConversation = useCallback(async () => {
      if (readyRef.current) return;
      readyRef.current = true;
      try {
        const ms = store.getState().interviewMachine;
        const companySlug = ms.companySlug || "meta";
        const roleSlug = ms.roleSlug || "frontend-engineer";
        const resp = await fetch(
          `/api/interviews/script?company=${companySlug}&role=${roleSlug}`
        );
        if (resp.ok) {
          const data = await resp.json();
          scriptRef.current = data;
          if (data?.backgroundQuestion)
            dispatch(
              setExpectedBackgroundQuestion({
                question: String(data.backgroundQuestion),
              })
            );
        }
      } catch {}
      const name = candidateName || "Candidate";
      dispatch(machineStart({ candidateName: name }));
      const persona = buildOpenAIInterviewerPrompt(
        String(store.getState().interviewMachine.companyName || "Company")
      );
      const instruction = `Say exactly: "Hi ${name}, I'm Carrie. I'll be the one interviewing today!"`;
      const greeting = await deliverAssistantPrompt({ persona, instruction });
      if (!greeting) {
        const fallback = `Hi ${name}, I'm Carrie. I'll be the one interviewing today!`;
        post(fallback, "ai");
        dispatch(machineAiFinal({ text: fallback }));
      }
      try {
        onStartConversation?.();
      } catch {}
    }, [candidateName, deliverAssistantPrompt, dispatch, onStartConversation, post]);

    useImperativeHandle(ref, () => ({
      startConversation,
      sendUserMessage,
    }));

    return null;
  }
);

OpenAITextConversation.displayName = "OpenAITextConversation";

export default OpenAITextConversation;