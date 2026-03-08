export const INTERVIEW_GUIDE_PREVIEW_STORAGE_PREFIX = "interview-guide-preview:";

export function getInterviewGuidePreviewStorageKey(companyId: string): string {
    return `${INTERVIEW_GUIDE_PREVIEW_STORAGE_PREFIX}${companyId}`;
}
