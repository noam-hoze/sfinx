interface CreateInterviewSessionParams {
    applicationId: string;
    companyId: string;
    userId?: string;
    isDemoMode?: boolean;
}

export const createInterviewSession = async ({
    applicationId,
    companyId,
    userId,
    isDemoMode = false,
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
