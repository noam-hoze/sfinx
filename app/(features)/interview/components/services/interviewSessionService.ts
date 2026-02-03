interface CreateInterviewSessionParams {
    applicationId: string;
    companyId: string;
    userId?: string;
    recordingStartedAt?: Date;
}

export const createInterviewSession = async ({
    applicationId,
    companyId,
    userId,
    recordingStartedAt,
}: CreateInterviewSessionParams) => {
    // Add skip-auth query param when userId is provided
    const skipAuth = !!userId;
    const url = skipAuth
        ? "/api/interviews/session?skip-auth=true"
        : "/api/interviews/session";

    const body: Record<string, any> = {
        applicationId,
        companyId,
    };

    // Include userId in body when provided (required for skip-auth)
    if (userId) {
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
