interface CreateApplicationParams {
    companyId: string;
    jobId: string | null;
}

export const createApplication = async ({
    companyId,
    jobId,
}: CreateApplicationParams) => {
    const response = await fetch("/api/applications/create", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            companyId,
            jobId,
        }),
    });

    if (!response.ok) {
        throw new Error("Failed to create application for interview");
    }

    return response.json();
};
