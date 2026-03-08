export function buildInterviewPath(companyId: string, jobId: string): string {
    const params = new URLSearchParams({
        companyId,
        jobId,
    });

    return `/interview?${params.toString()}`;
}

export function buildInterviewUrl(
    origin: string | undefined,
    companyId: string,
    jobId: string
): string {
    const path = buildInterviewPath(companyId, jobId);
    if (!origin) {
        return path;
    }

    return new URL(path, origin).toString();
}
