interface CreateApplicationParams {
    companyId: string;
    jobId: string | null;
    userId?: string;
}

export const createApplication = async ({
    companyId,
    jobId,
    userId,
}: CreateApplicationParams) => {
    const url = "/api/applications/create";

    const body: Record<string, any> = {
        companyId,
        jobId,
    };

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
