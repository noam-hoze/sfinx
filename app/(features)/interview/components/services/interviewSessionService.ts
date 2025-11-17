interface CreateInterviewSessionParams {
    applicationId: string;
    companyId: string;
    userId?: string;
    isDemoMode?: boolean;
    recordingStartedAt?: Date;
}

export const createInterviewSession = async ({
    applicationId,
    companyId,
    userId,
    isDemoMode = false,
    recordingStartedAt,
}: CreateInterviewSessionParams) => {
    const url = isDemoMode
        ? "/api/interviews/session?skip-auth=true"
        : "/api/interviews/session";

    const body: Record<string, any> = {
        applicationId,
        companyId,
    };

    if (isDemoMode && userId) {
        body.userId = userId;
    }

    if (recordingStartedAt) {
        body.recordingStartedAt = recordingStartedAt.toISOString();
    }

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error("Failed to create interview session");
    }

    return response.json();
};
