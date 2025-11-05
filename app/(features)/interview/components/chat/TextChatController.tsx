"use client";

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import OpenAI from "openai";
import { useDispatch } from "react-redux";
import { addMessage } from "@/shared/state/slices/interviewChatSlice";
import { store } from "@/shared/state/store";
import { setExpectedBackgroundQuestion, start as machineStart, aiFinal as machineAiFinal, userFinal as machineUserFinal } from "@/shared/state/slices/interviewMachineSlice";
import { buildOpenAIBackgroundPrompt } from "@/shared/prompts/openAIInterviewerPrompt";
import { interviewChatStore } from "@/shared/state/interviewChatStore";
import { buildDeltaControlMessages, CONTROL_CONTEXT_TURNS, parseControlResult } from "../../../../shared/services";

type Props = { candidateName?: string; onStartConversation?: () => void };

const TextChatController = forwardRef<any, Props>(({ candidateName = "Candidate", onStartConversation }, ref) => {
  const dispatch = useDispatch();
  const openaiClient = useMemo(() => new OpenAI({ apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || "", dangerouslyAllowBrowser: true }), []);
  const readyRef = useRef(false);

  const post = useCallback((text: string, speaker: "user" | "ai") => {
    if (!text) return;
    dispatch(addMessage({ text, speaker }));
    try {
      interviewChatStore.dispatch({ type: "ADD_MESSAGE", payload: { text, speaker } } as any);
    } catch {}
  }, [dispatch]);

  const askViaChat = useCallback(async (system: string, history: Array<{ role: "user" | "assistant"; content: string }>) => {
    const completion = await openaiClient.chat.completions.create({ model: "gpt-4o-mini", temperature: 0.2, messages: [{ role: "system", content: system }, ...history] as any });
    const txt = completion.choices?.[0]?.message?.content?.trim() || "";
    return txt;
  }, [openaiClient]);

  const requestControl = useCallback(async () => {
    const im = store.getState().interviewMachine;
    const company = String(im.companyName || im.companySlug || "Unknown Company");
    const role = String(im.roleSlug || "role").replace(/[-_]/g, " ");
    const { system: roHistory, assistant: lastQ, user: lastA } = buildDeltaControlMessages(CONTROL_CONTEXT_TURNS);
    const system = `You are the evaluation module for a technical interview at ${company} for the ${role} position.\nStage: Background.\n\nCRITICAL RULES:\n- Score ONLY the last user answer that follows.\n- Use the read-only history for understanding terms only; DO NOT award credit for past turns.\n- If the last user answer contains no concrete, attributable evidence for a pillar, output 0 for that pillar.\n- Every non-zero pillar MUST be justified with a short rationale referencing exact phrases from the last answer.\n- DO NOT initiate or suggest moving to coding; that decision is external and controlled by the system.\n\n${roHistory}\n\nOutput: STRICT JSON only (no preface) with fields: pillars {adaptability, creativity, reasoning} (0-100), rationale (string explaining your decision), pillarRationales {adaptability: string, creativity: string, reasoning: string}.`;
    const completion = await openaiClient.chat.completions.create({ model: "gpt-4o-mini", temperature: 0, messages: [{ role: "system", content: system }, lastQ ? { role: "assistant", content: lastQ } as any : undefined, lastA ? { role: "user", content: lastA } as any : undefined].filter(Boolean) as any, });
    const txt = completion.choices?.[0]?.message?.content ?? "";
    try {
      const parsed = parseControlResult(txt);
      // Mirror updates similar to OpenAIConversation
      interviewChatStore.dispatch({ type: "BG_SET_CONTROL_RESULT", payload: { confidence: (parsed.pillars.adaptability + parsed.pillars.creativity + parsed.pillars.reasoning) / 3, pillars: parsed.pillars, rationales: { overall: parsed.rationale, adaptability: parsed.pillarRationales?.adaptability, creativity: parsed.pillarRationales?.creativity, reasoning: parsed.pillarRationales?.reasoning, }, }, } as any);
      interviewChatStore.dispatch({ type: "BG_ACCUMULATE_CONTROL_RESULT", payload: { pillars: parsed.pillars }, } as any);
    } catch {}
  }, [openaiClient]);

  const sendUserMessage = useCallback(async (text: string) => {
    post(text, "user");
    dispatch(machineUserFinal());

    const ms = store.getState().interviewMachine;
    if (ms.state === "greeting_responded_by_user") {
      // Ask the scripted background question
      const expectedQ = (window as any).__sfinxScript?.backgroundQuestion;
      if (expectedQ) {
        post(String(expectedQ), "ai");
        dispatch(machineAiFinal({ text: String(expectedQ) }));
        interviewChatStore.dispatch({ type: "SET_STAGE", payload: "background" } as any);
        return;
      }
    }

    if (ms.state === "background_answered_by_user") {
      // Run CONTROL and then ask a short follow-up
      await requestControl();
      const im = store.getState().interviewMachine;
      const persona = buildOpenAIBackgroundPrompt(String(im.companyName || "Company"));
      const follow = await askViaChat(persona, [{ role: "assistant", content: "Ask one short follow-up about their project." }, { role: "user", content: text }]);
      if (follow) {
        post(follow, "ai");
        dispatch(machineAiFinal({ text: follow }));
      }
      return;
    }
  }, [askViaChat, dispatch, post, requestControl]);

  const startConversation = useCallback(async () => {
    if (readyRef.current) return;
    readyRef.current = true;
    try {
      const ms = store.getState().interviewMachine;
      const companySlug = ms.companySlug || "meta";
      const roleSlug = ms.roleSlug || "frontend-engineer";
      const resp = await fetch(`/api/interviews/script?company=${companySlug}&role=${roleSlug}`);
      if (resp.ok) {
        const data = await resp.json();
        (window as any).__sfinxScript = data;
        if (data?.backgroundQuestion) dispatch(setExpectedBackgroundQuestion({ question: String(data.backgroundQuestion) }));
      }
    } catch {}
    const name = candidateName || "Candidate";
    dispatch(machineStart({ candidateName: name }));
    const greeting = `Hi ${name}, I'm Carrie. I'll be the one interviewing today!`;
    post(greeting, "ai");
    dispatch(machineAiFinal({ text: greeting }));
    try { onStartConversation?.(); } catch {}
  }, [candidateName, dispatch, post]);

  useImperativeHandle(ref, () => ({
    startConversation,
    sendUserMessage,
  }));

  return null;
});

TextChatController.displayName = "TextChatController";
export default TextChatController;


