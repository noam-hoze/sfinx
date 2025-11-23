/** Helpers supporting OpenAITextConversation completions. */
import OpenAI from "openai";
import { store } from "@/shared/state/store";
import { interviewChatStore } from "@/shared/state/interviewChatStore";
import {
  buildDeltaControlMessages,
  CONTROL_CONTEXT_TURNS,
  parseControlResult,
} from "../../../../shared/services";

/** Requests a lightweight chat completion for background follow-ups. */
export async function askViaChatCompletion(
  client: OpenAI,
  system: string,
  history: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string> {
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [{ role: "system", content: system }, ...history] as any,
  });
  const txt = completion.choices?.[0]?.message?.content?.trim();
  if (!txt) {
    throw new Error("OpenAI chat completion is missing content");
  }
  return txt;
}

/** Runs CONTROL evaluation and mirrors the result into the background store. */
export async function runBackgroundControl(client: OpenAI): Promise<void> {
  const im = store.getState().interviewMachine;
  const companySource = im.companyName ?? im.companySlug;
  if (!companySource) {
    throw new Error("Interview machine missing company identifier");
  }
  const roleSource = im.roleSlug;
  if (!roleSource) {
    throw new Error("Interview machine missing role slug");
  }
  const {
    system: roHistory,
    assistant: lastQ,
    user: lastA,
  } = buildDeltaControlMessages(CONTROL_CONTEXT_TURNS);
  
  const isBlankAnswer = !lastA || lastA.trim().length === 0;
  
  const baseSystemPrompt = `You are the evaluation module for a technical interview at ${companySource} for the ${String(
    roleSource
  ).replace(/[-_]/g, " ")} position.\nStage: Background.\n\nCRITICAL RULES:\n- Score ONLY the last user answer that follows.\n- Use the read-only history for understanding terms only; DO NOT award credit for past turns.\n- If the last user answer contains no concrete, attributable evidence for a pillar, output 0 for that pillar.\n- Every non-zero pillar MUST be justified with a short rationale referencing exact phrases from the last answer.\n- DO NOT initiate or suggest moving to coding; that decision is external and controlled by the system.\n\n${roHistory}\n\nOutput: STRICT JSON only (no preface) with fields: pillars {adaptability, creativity, reasoning} (0-100), rationale (string explaining your decision), pillarRationales {adaptability: string, creativity: string, reasoning: string}.`;
  
  const system = isBlankAnswer 
    ? `${baseSystemPrompt}\n\nIMPORTANT: The user provided a blank or empty response. You MUST return 0 for all pillars (adaptability: 0, creativity: 0, reasoning: 0).`
    : baseSystemPrompt;
  
  const messages = [
    { role: "system", content: system },
    lastQ ? ({ role: "assistant", content: lastQ } as any) : undefined,
    lastA ? ({ role: "user", content: lastA } as any) : undefined,
  ].filter(Boolean) as any;
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages,
  });
  const txt = completion.choices?.[0]?.message?.content ?? "";
  let parsed = parseControlResult(txt);
  
  // For blank answers, force 0/0/0 and check if OpenAI complied
  if (isBlankAnswer) {
    const aiReturnedZeros = 
      parsed.pillars.adaptability === 0 && 
      parsed.pillars.creativity === 0 && 
      parsed.pillars.reasoning === 0;
    
    if (!aiReturnedZeros) {
      console.error(
        "[runBackgroundControl] ERROR: OpenAI did not return 0/0/0 for blank answer. Received:",
        parsed.pillars,
        "Forcing 0/0/0 anyway."
      );
    }
    
    // Force 0/0/0 regardless
    parsed = {
      pillars: { adaptability: 0, creativity: 0, reasoning: 0 },
      rationale: "Blank response provided - no evidence to evaluate.",
      pillarRationales: {
        adaptability: "No evidence provided.",
        creativity: "No evidence provided.",
        reasoning: "No evidence provided.",
      },
    };
  }
  
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
}

/** Produces an assistant reply for scripted persona prompts. */
export async function generateAssistantReply(
  client: OpenAI,
  persona: string,
  instruction: string
): Promise<string | null> {
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      { role: "system", content: persona },
      { role: "user", content: instruction },
    ],
  });
  return completion.choices?.[0]?.message?.content?.trim() || null;
}

/** Builds the closing-line system instruction for the interviewer. */
export function buildClosingInstruction(candidateName: string): string {
  const trimmed = candidateName.trim();
  const name = trimmed.length > 0 ? trimmed : "there";
  return `Say exactly: "Thank you so much ${name}, the next steps will be shared with you shortly."`;
}

