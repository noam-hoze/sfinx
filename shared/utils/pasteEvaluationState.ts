import type { CodingState } from "@/shared/state/slices/codingSlice";
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
