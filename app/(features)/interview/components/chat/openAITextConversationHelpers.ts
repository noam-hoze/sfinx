/** Helpers supporting OpenAITextConversation completions - now via backend API. */
import { buildControlContextMessages, CONTROL_CONTEXT_TURNS } from "app/shared/services";
import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.OPENAI;

type InterviewChatPayload = {
  persona: string;
  instruction?: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
};

/** Posts a chat request to the interview API and returns the model response text. */
async function postInterviewChat(
  payload: InterviewChatPayload,
  failureMessage: string
): Promise<string> {
  const response = await fetch("/api/interviews/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || failureMessage);
  }

  const data = await response.json();
  return data.response;
}

/** Requests a lightweight chat completion for background follow-ups via backend API. */
export async function askViaChatCompletion(
  _client: any, // Deprecated - kept for backward compatibility
  system: string,
  history: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string> {
  return postInterviewChat(
    {
      persona: system,
      conversationHistory: history,
    },
    "Failed to generate question"
  );
}

/** Produces an assistant reply for scripted persona prompts via backend API. */
export async function generateAssistantReply(
  _client: any, // Deprecated - kept for backward compatibility
  persona: string,
  instruction: string
): Promise<string | null> {
  return postInterviewChat(
    {
      persona,
      instruction,
    },
    "Failed to generate assistant reply"
  );
}

/** Builds the closing-line system instruction for the interviewer. */
export function buildClosingInstruction(candidateName: string): string {
  const trimmed = candidateName.trim();
  const name = trimmed.length > 0 ? trimmed : "there";
  return `Say exactly: "Thank you so much ${name}, the next steps will be shared with you shortly."`;
}
