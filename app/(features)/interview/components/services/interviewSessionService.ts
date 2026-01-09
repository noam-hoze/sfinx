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
    const url = "/api/interviews/session";

    const body: Record<string, any> = {
        applicationId,
        companyId,
    };

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
