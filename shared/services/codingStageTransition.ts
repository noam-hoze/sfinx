/**
 * Shared helpers for moving interview flows into the coding stage.
 */
import { interviewChatStore } from "@/shared/state/interviewChatStore";
import { AppDispatch } from "@/shared/state/store";
import { forceCoding, setCompanyContext } from "@/shared/state/slices/interviewMachineSlice";

/**
 * Dispatches the necessary state updates to enter the coding experience.
 */
export const startCodingStage = (
  dispatch: AppDispatch,
  context: {
    companyName?: string | null;
    companySlug?: string | null;
    roleSlug?: string | null;
  },
  setShowCodingIDE: (show: boolean) => void,
) => {
  const resolvedCompanyName =
    context.companyName ||
    (context.companySlug
      ? `${context.companySlug.charAt(0).toUpperCase()}${context.companySlug.slice(1)}`
      : "Meta");

  dispatch(
    setCompanyContext({
      companyName: resolvedCompanyName,
      companySlug: context.companySlug || "meta",
      roleSlug: context.roleSlug || "frontend-engineer",
    })
  );
  dispatch(forceCoding());
  interviewChatStore.dispatch({ type: "SET_STAGE", payload: "coding" } as any);
  setShowCodingIDE(true);
};
