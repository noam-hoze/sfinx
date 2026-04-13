/**
 * Unit tests for interview processing submit retries.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    error: vi.fn(),
    warn: vi.fn(),
}));

vi.mock("app/shared/services/logger", () => ({
    log: {
        error: mocks.error,
        warn: mocks.warn,
    },
}));

vi.mock("app/shared/services/logger.config", () => ({
    LOG_CATEGORIES: {
        INTERVIEW_UI: "INTERVIEW_UI",
    },
}));

import { triggerInterviewProcessing } from "./processInterviewSubmission";

function makeResponse(status: number, body = "") {
    return {
        ok: status >= 200 && status < 300,
        status,
        text: vi.fn().mockResolvedValue(body),
    } as unknown as Response;
}

describe("triggerInterviewProcessing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("uses skip-auth immediately for unauthenticated candidate submits", async () => {
        const fetchMock = vi.fn().mockResolvedValue(makeResponse(202));
        vi.stubGlobal("fetch", fetchMock);

        await triggerInterviewProcessing({
            interviewSessionId: "session-1",
            finalCode: "const x = 1;",
            fallbackUserId: "candidate-1",
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][0]).toContain("?skip-auth=true");
        expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
            finalCode: "const x = 1;",
            userId: "candidate-1",
        });
    });

    it("retries with skip-auth when the authenticated request is rejected", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(makeResponse(401, "Unauthorized"))
            .mockResolvedValueOnce(makeResponse(202));
        vi.stubGlobal("fetch", fetchMock);

        await triggerInterviewProcessing({
            interviewSessionId: "session-1",
            finalCode: "const x = 1;",
            authenticatedUserId: "candidate-1",
            fallbackUserId: "candidate-1",
        });

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[0][0]).not.toContain("?skip-auth=true");
        expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
            finalCode: "const x = 1;",
        });
        expect(fetchMock.mock.calls[1][0]).toContain("?skip-auth=true");
        expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).toEqual({
            finalCode: "const x = 1;",
            userId: "candidate-1",
        });
        expect(mocks.warn).toHaveBeenCalledOnce();
        expect(mocks.error).not.toHaveBeenCalled();
    });

    it("logs failures that are not eligible for the skip-auth retry", async () => {
        const fetchMock = vi.fn().mockResolvedValue(makeResponse(409, "Conflict"));
        vi.stubGlobal("fetch", fetchMock);

        await triggerInterviewProcessing({
            interviewSessionId: "session-1",
            finalCode: "const x = 1;",
            authenticatedUserId: "candidate-1",
            fallbackUserId: "candidate-1",
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(mocks.warn).not.toHaveBeenCalled();
        expect(mocks.error).toHaveBeenCalledOnce();
    });
});
