/**
 * Triggers server-side interview processing and retries through skip-auth when
 * browser auth and server auth disagree for the candidate submit flow.
 */
import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const logger = log;
const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEW_UI;
const JSON_HEADERS = { "Content-Type": "application/json" };

type TriggerInterviewProcessingParams = {
    interviewSessionId: string;
    finalCode: string;
    authenticatedUserId?: string;
    fallbackUserId?: string | null;
};

function getProcessUrl(sessionId: string, userId?: string): string {
    return userId
        ? `/api/interviews/session/${sessionId}/process?skip-auth=true`
        : `/api/interviews/session/${sessionId}/process`;
}

function buildRequestBody(finalCode: string, userId?: string) {
    return JSON.stringify({ finalCode, ...(userId ? { userId } : {}) });
}

async function sendProcessRequest(sessionId: string, finalCode: string, userId?: string) {
    return fetch(getProcessUrl(sessionId, userId), {
        method: "POST",
        headers: JSON_HEADERS,
        body: buildRequestBody(finalCode, userId),
    });
}

function shouldRetryAsSkipAuth(
    response: Response,
    authenticatedUserId?: string,
    fallbackUserId?: string | null
): fallbackUserId is string {
    return Boolean(authenticatedUserId && fallbackUserId && [401, 404].includes(response.status));
}

async function logProcessFailure(sessionId: string, response: Response) {
    const details = await response.text().catch(() => "");
    logger.error(
        LOG_CATEGORY,
        `[InterviewIDE] Failed to trigger processing for ${sessionId}: ${response.status} ${details}`
    );
}

/** Triggers interview processing without silently swallowing authorization mismatches. */
export async function triggerInterviewProcessing({
    interviewSessionId,
    finalCode,
    authenticatedUserId,
    fallbackUserId,
}: TriggerInterviewProcessingParams): Promise<void> {
    const primaryUserId = authenticatedUserId ? undefined : fallbackUserId ?? undefined;
    const primaryResponse = await sendProcessRequest(interviewSessionId, finalCode, primaryUserId);
    if (primaryResponse.ok) return;
    if (!shouldRetryAsSkipAuth(primaryResponse, authenticatedUserId, fallbackUserId)) {
        await logProcessFailure(interviewSessionId, primaryResponse);
        return;
    }
    logger.warn(LOG_CATEGORY, `[InterviewIDE] Retrying interview processing via skip-auth for ${interviewSessionId}`);
    const retryResponse = await sendProcessRequest(interviewSessionId, finalCode, fallbackUserId);
    if (!retryResponse.ok) await logProcessFailure(interviewSessionId, retryResponse);
}
