interface CreateInterviewSessionParams {
    applicationId: string;
    companyId: string;
}

export const createInterviewSession = async ({
    applicationId,
    companyId,
}: CreateInterviewSessionParams) => {
    const response = await fetch("/api/interviews/session", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            applicationId,
            companyId,
        }),
    });

    if (!response.ok) {
        throw new Error("Failed to create interview session");
    }

    return response.json();
};
