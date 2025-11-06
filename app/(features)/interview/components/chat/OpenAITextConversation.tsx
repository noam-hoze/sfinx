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
  buildDeltaControlMessages,
  CONTROL_CONTEXT_TURNS,
  parseControlResult,
} from "../../../../shared/services";

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

    const askViaChat = useCallback(
      async (
        system: string,
        history: Array<{ role: "user" | "assistant"; content: string }>
      ) => {
        const completion = await openaiClient.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.2,
          messages: [{ role: "system", content: system }, ...history] as any,
        });
        const txt = completion.choices?.[0]?.message?.content?.trim();
        if (!txt) {
          throw new Error("OpenAI chat completion is missing content");
        }
        return txt;
      },
      [openaiClient]
    );

    const requestControl = useCallback(async () => {
      const im = store.getState().interviewMachine;
      const companySource = im.companyName ?? im.companySlug;
      if (!companySource) {
        throw new Error("Interview machine missing company identifier");
      }
      const company = String(companySource);
      const roleSource = im.roleSlug;
      if (!roleSource) {
        throw new Error("Interview machine missing role slug");
      }
      const role = String(roleSource).replace(/[-_]/g, " ");
      const {
        system: roHistory,
        assistant: lastQ,
        user: lastA,
      } = buildDeltaControlMessages(CONTROL_CONTEXT_TURNS);
      const system = `You are the evaluation module for a technical interview at ${company} for the ${role} position.\nStage: Background.\n\nCRITICAL RULES:\n- Score ONLY the last user answer that follows.\n- Use the read-only history for understanding terms only; DO NOT award credit for past turns.\n- If the last user answer contains no concrete, attributable evidence for a pillar, output 0 for that pillar.\n- Every non-zero pillar MUST be justified with a short rationale referencing exact phrases from the last answer.\n- DO NOT initiate or suggest moving to coding; that decision is external and controlled by the system.\n\n${roHistory}\n\nOutput: STRICT JSON only (no preface) with fields: pillars {adaptability, creativity, reasoning} (0-100), rationale (string explaining your decision), pillarRationales {adaptability: string, creativity: string, reasoning: string}.`;
      const completion = await openaiClient.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          { role: "system", content: system },
          lastQ ? ({ role: "assistant", content: lastQ } as any) : undefined,
          lastA ? ({ role: "user", content: lastA } as any) : undefined,
        ].filter(Boolean) as any,
      });
      const txt = completion.choices?.[0]?.message?.content ?? "";
      try {
        const parsed = parseControlResult(txt);
        // Mirror updates similar to OpenAIVoiceConversation
        interviewChatStore.dispatch({
          type: "BG_SET_CONTROL_RESULT",
          payload: {
            confidence:
              (parsed.pillars.adaptability +
                parsed.pillars.creativity +
                parsed.pillars.reasoning) /
              3,
            pillars: parsed.pillars,
            rationales: {
              overall: parsed.rationale,
              adaptability: parsed.pillarRationales?.adaptability,
              creativity: parsed.pillarRationales?.creativity,
              reasoning: parsed.pillarRationales?.reasoning,
            },
          },
        } as any);
        interviewChatStore.dispatch({
          type: "BG_ACCUMULATE_CONTROL_RESULT",
          payload: { pillars: parsed.pillars },
        } as any);
      } catch {}
    }, [openaiClient]);

    const persistAssistantMessage = useCallback(
      (message: string) => {
        if (!message) return;
        post(message, "ai");
        dispatch(machineAiFinal({ text: message }));
      },
      [dispatch, post]
    );

    const requestCompletion = useCallback(
      async ({
        persona,
        instruction,
        temperature = 0,
      }: {
        persona: string;
        instruction: string;
        temperature?: number;
      }) => {
        const completion = await openaiClient.chat.completions.create({
          model: "gpt-4o-mini",
          temperature,
          messages: [
            { role: "system", content: persona },
            { role: "user", content: instruction },
          ],
        });
        return completion.choices?.[0]?.message?.content?.trim() || "";
      },
      [openaiClient]
    );

    const deliverAssistantPrompt = useCallback(
      async ({ persona, instruction }: { persona: string; instruction: string }) => {
        const answer = await requestCompletion({ persona, instruction });
        if (!answer) return null;
        persistAssistantMessage(answer);
        return answer;
      },
      [persistAssistantMessage, requestCompletion]
    );

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
          await requestControl();
          const im = store.getState().interviewMachine;
          if (!im.companyName) {
            throw new Error("Interview machine missing companyName");
          }
          const persona = buildOpenAIBackgroundPrompt(String(im.companyName));
          const follow = await askViaChat(persona, [
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
      [askViaChat, deliverAssistantPrompt, dispatch, post, requestControl]
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
      sendUserMessage,
    }));

    useEffect(() => {
      startConversation();
    }, [startConversation]);

    return (
      <div className="chat-container">
        <div className="chat-messages">
          {/* Messages will be rendered here */}
        </div>
        <div className="chat-input-container">
          <input
            type="text"
            placeholder="Type your message..."
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                sendUserMessage(e.currentTarget.value);
                e.currentTarget.value = "";
              }
            }}
          />
        </div>
      </div>
    );
  }
);

export default OpenAITextConversation;