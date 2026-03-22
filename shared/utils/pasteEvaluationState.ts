import type { ChatMessage, CodingState } from "@/shared/state/slices/codingSlice";
import type { AnswerType } from "@/shared/services/backgroundInterview/answerClassification";

/** Returns true once a paste evaluation has a finalized score or summary. */
export function hasFinalizedPasteEvaluation(
  activePasteEvaluation?: CodingState["activePasteEvaluation"]
): boolean {
  return Boolean(
    activePasteEvaluation?.accountabilityScore !== undefined ||
    activePasteEvaluation?.evaluationReasoning ||
    activePasteEvaluation?.evaluationCaption
  );
}

/** Returns true once the evaluation is complete, even before persistence finishes. */
export function isCompletedPasteEvaluation(
  activePasteEvaluation?: CodingState["activePasteEvaluation"]
): boolean {
  return Boolean(
    activePasteEvaluation?.readyToEvaluate ||
    hasFinalizedPasteEvaluation(activePasteEvaluation)
  );
}

/** Returns true only for unfinished paste-eval state that lost its active question. */
export function shouldClearStuckPasteEvaluation(
  activePasteEvaluation?: CodingState["activePasteEvaluation"]
): boolean {
  return Boolean(
    activePasteEvaluation &&
    !activePasteEvaluation.currentQuestion &&
    !isCompletedPasteEvaluation(activePasteEvaluation)
  );
}

/** Clarification turns re-ask the same question and do not consume paste-eval budget. */
export function getUpdatedPasteAnswerCount(
  currentCount: number,
  detectedAnswerType?: AnswerType
): number {
  return currentCount + (detectedAnswerType === "clarification_request" ? 0 : 1);
}

/** Counts clarification turns so paste-eval retries still have a hard stop. */
export function getPasteClarificationCount(
  questionScores?: Array<{ detectedAnswerType?: AnswerType }>
): number {
  return questionScores?.filter(
    (questionScore) => questionScore.detectedAnswerType === "clarification_request"
  ).length ?? 0;
}

/** Builds the persisted paste-eval transcript from tagged chat messages. */
export function getPasteEvalConversation(
  messages: ChatMessage[],
  pasteTimestamp: number
): {
  conversation: Array<{ role: "user" | "assistant"; content: string }>;
  aiQuestions: string;
  userAnswers: string;
} {
  const conversation = messages
    .filter((message) => message.isPasteEval && message.timestamp >= pasteTimestamp)
    .map((message) => ({
      role: message.speaker === "user" ? "user" as const : "assistant" as const,
      content: message.text,
    }));

  return {
    conversation,
    aiQuestions: conversation
      .filter((message) => message.role === "assistant")
      .map((message) => message.content)
      .join("\n"),
    userAnswers: conversation
      .filter((message) => message.role === "user")
      .map((message) => message.content)
      .join("\n"),
  };
}
