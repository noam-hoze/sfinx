/** Helpers supporting OpenAITextConversation completions - now via backend API. */
import { buildControlContextMessages, CONTROL_CONTEXT_TURNS } from "app/shared/services";
import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.OPENAI;

/** Requests a lightweight chat completion for background follow-ups via backend API. */
export async function askViaChatCompletion(
  system: string,
  history: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string> {
  const response = await fetch("/api/interviews/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      persona: system,
      conversationHistory: history,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || "Failed to generate question");
  }

  const data = await response.json();
  return data.response;
}

/** Produces an assistant reply for scripted persona prompts via backend API. */
export async function generateAssistantReply(
  persona: string,
  instruction: string
): Promise<string | null> {
  const response = await fetch("/api/interviews/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      persona,
      instruction,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || "Failed to generate assistant reply");
  }

  const data = await response.json();
  return data.response;
}

/** Builds the closing-line system instruction for the interviewer. */
export function buildClosingInstruction(candidateName: string): string {
  const trimmed = candidateName.trim();
  const name = trimmed.length > 0 ? trimmed : "there";
  return `Say exactly: "Thank you so much ${name}, the next steps will be shared with you shortly."`;
}

