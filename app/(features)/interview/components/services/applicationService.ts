interface CreateApplicationParams {
    companyId: string;
    jobId: string | null;
    userId?: string;
    isDemoMode?: boolean;
}

export const createApplication = async ({
    companyId,
    jobId,
    userId,
    isDemoMode = false,
}: CreateApplicationParams) => {
    const url = isDemoMode
        ? "/api/applications/create?skip-auth=true"
        : "/api/applications/create";

    const body: Record<string, any> = {
        companyId,
        jobId,
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
        throw new Error("Failed to create application for interview");
    }

    return response.json();
};
