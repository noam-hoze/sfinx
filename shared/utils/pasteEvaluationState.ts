import type { CodingState } from "@/shared/state/slices/codingSlice";

/** Returns true only for unfinished paste-eval state that lost its active question. */
export function shouldClearStuckPasteEvaluation(
  activePasteEvaluation?: CodingState["activePasteEvaluation"]
): boolean {
  return Boolean(
    activePasteEvaluation &&
    !activePasteEvaluation.currentQuestion &&
    !activePasteEvaluation.readyToEvaluate
  );
}
