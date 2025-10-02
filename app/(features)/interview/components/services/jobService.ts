export const fetchJobById = async (jobId: string) => {
    const response = await fetch(`/api/jobs/${jobId}`);

    if (!response.ok) {
        throw new Error("Failed to fetch job");
    }

    return response.json();
};
