/**
 * Unit tests for background preload validation.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useBackgroundPreload } from "./useBackgroundPreload";
import { createInterviewSession } from "app/(features)/interview/components/services/interviewSessionService";
import { generateAssistantReply } from "app/(features)/interview/components/chat/openAITextConversationHelpers";
import { log } from "app/shared/services/logger";

vi.mock("react", () => ({ useCallback: (fn: any) => fn }));
vi.mock("react-redux", () => ({ useDispatch: () => vi.fn() }));
vi.mock("app/shared/services/logger", () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("app/(features)/interview/components/services/interviewSessionService", () => ({
    createInterviewSession: vi.fn(),
}));
vi.mock("app/(features)/interview/components/chat/openAITextConversationHelpers", () => ({
    generateAssistantReply: vi.fn(),
}));

/**
 * Build a mock fetch response.
 */
function buildResponse(payload: any) {
    return { ok: true, json: async () => payload };
}

/**
 * Set up mock localStorage.
 */
function setupLocalStorage() {
    const store = new Map<string, string>();
    global.localStorage = {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
        removeItem: (key: string) => store.delete(key),
    } as Storage;
}

beforeEach(() => {
    vi.resetAllMocks();
    setupLocalStorage();
});

describe("useBackgroundPreload", () => {
    it("throws when script companyName is missing", async () => {
        global.fetch = vi.fn()
            .mockResolvedValueOnce(buildResponse({ application: { id: "app-1" } }))
            .mockResolvedValueOnce(buildResponse({ backgroundQuestion: "Question?" })) as any;
        vi.mocked(createInterviewSession).mockResolvedValue({ interviewSession: { id: "sess-1" } } as any);
        const { preload } = useBackgroundPreload();
        await expect(preload("acme-role", "comp-1", {} as any, "user-1")).rejects.toThrow("companyName is required");
        expect(log.error).toHaveBeenCalled();
    });

    it("clears invalid cached script and refetches", async () => {
        localStorage.setItem("interview-script-acme-role-v8", "not-json");
        global.fetch = vi.fn()
            .mockResolvedValueOnce(buildResponse({ application: { id: "app-1" } }))
            .mockResolvedValueOnce(buildResponse({ companyName: "Acme", backgroundQuestion: "Question?", experienceCategories: [] })) as any;
        vi.mocked(createInterviewSession).mockResolvedValue({ interviewSession: { id: "sess-1" } } as any);
        vi.mocked(generateAssistantReply).mockResolvedValue(JSON.stringify({ question: "Q", evaluationIntent: "Listen" }));
        const { preload } = useBackgroundPreload();
        await preload("acme-role", "comp-1", {} as any, "user-1");
        expect(localStorage.getItem("interview-script-acme-role-v8")).not.toBe("not-json");
    });

    it("throws when first question JSON is invalid", async () => {
        global.fetch = vi.fn()
            .mockResolvedValueOnce(buildResponse({ application: { id: "app-1" } }))
            .mockResolvedValueOnce(buildResponse({ companyName: "Acme", backgroundQuestion: "Question?", experienceCategories: [] })) as any;
        vi.mocked(createInterviewSession).mockResolvedValue({ interviewSession: { id: "sess-1" } } as any);
        vi.mocked(generateAssistantReply).mockResolvedValue("not-json");
        const { preload } = useBackgroundPreload();
        await expect(preload("acme-role", "comp-1", {} as any, "user-1")).rejects.toThrow();
        expect(log.error).toHaveBeenCalled();
    });
});
