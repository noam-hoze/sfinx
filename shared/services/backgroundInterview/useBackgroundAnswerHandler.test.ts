/**
 * Unit tests for background answer handler validation.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { log } from "app/shared/services/logger";
import { store } from "@/shared/state/store";
import { useBackgroundAnswerHandler } from "./useBackgroundAnswerHandler";

const mockState = {
    interview: {
        companyName: "Acme",
        sessionId: undefined,
        userId: "user-1",
        script: { experienceCategories: [] },
    },
    background: { categoryStats: [] },
};

vi.mock("react", () => ({ useCallback: (fn: any) => fn }));
vi.mock("react-redux", () => ({
    useDispatch: () => vi.fn(),
    useSelector: (selector: any) => selector(mockState),
}));
vi.mock("app/shared/services/logger", () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/shared/state/store", () => ({
    store: { getState: vi.fn() },
}));
vi.mock("app/(features)/interview/components/chat/openAITextConversationHelpers", () => ({
    generateAssistantReply: vi.fn(),
}));

beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(store.getState).mockReturnValue({ background: { messages: [] }, interview: { stage: "background" } } as any);
});

describe("useBackgroundAnswerHandler", () => {
    it("throws when OpenAI client is missing", async () => {
        const { handleSubmit } = useBackgroundAnswerHandler();
        await expect(handleSubmit("answer", null, "Candidate")).rejects.toThrow("OpenAI client is required");
        expect(log.error).toHaveBeenCalled();
    });

    it("throws when current question is missing", async () => {
        const { handleSubmit } = useBackgroundAnswerHandler();
        await expect(handleSubmit("answer", {} as any, "Candidate")).rejects.toThrow("currentQuestion is required");
        expect(log.error).toHaveBeenCalled();
    });
});
