/** Helpers supporting OpenAITextConversation completions. */
import OpenAI from "openai";
import { buildControlContextMessages, CONTROL_CONTEXT_TURNS } from "app/shared/services";

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

