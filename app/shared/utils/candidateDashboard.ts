export type CandidateApplicationStatus =
    | "WARMUP"
    | "PENDING"
    | "REVIEWED"
    | "INTERVIEWING"
    | "ACCEPTED"
    | "REJECTED";

export type CandidateInterviewStatus =
    | "IN_PROGRESS"
    | "PROCESSING"
    | "COMPLETED"
    | "ABANDONED"
    | null;

export type CandidateDisplayStatus =
    | "Interview in progress"
    | "Processing results"
    | "Accepted"
    | "Not selected"
    | "Interviewing"
    | "Interview completed"
    | "Under review"
    | "Pending review";

export interface CandidateStatusDescriptor {
    label: CandidateDisplayStatus;
    tone: "violet" | "blue" | "green" | "red" | "amber" | "slate";
    isFinal: boolean;
}

export function deriveCandidateDisplayStatus(
    applicationStatus: CandidateApplicationStatus,
    latestInterviewStatus: CandidateInterviewStatus
): CandidateStatusDescriptor {
    if (latestInterviewStatus === "IN_PROGRESS") {
        return {
            label: "Interview in progress",
            tone: "blue",
            isFinal: false,
        };
    }

    if (latestInterviewStatus === "PROCESSING") {
        return {
            label: "Processing results",
            tone: "violet",
            isFinal: false,
        };
    }

    if (applicationStatus === "ACCEPTED") {
        return {
            label: "Accepted",
            tone: "green",
            isFinal: true,
        };
    }

    if (applicationStatus === "REJECTED") {
        return {
            label: "Not selected",
            tone: "red",
            isFinal: true,
        };
    }

    if (applicationStatus === "INTERVIEWING") {
        return {
            label: "Interviewing",
            tone: "blue",
            isFinal: false,
        };
    }

    if (latestInterviewStatus === "COMPLETED") {
        return {
            label: "Interview completed",
            tone: "green",
            isFinal: false,
        };
    }

    if (applicationStatus === "REVIEWED") {
        return {
            label: "Under review",
            tone: "amber",
            isFinal: false,
        };
    }

    return {
        label: "Pending review",
        tone: "slate",
        isFinal: false,
    };
}

export function isActiveDashboardStatus(label: CandidateDisplayStatus): boolean {
    return [
        "Interview in progress",
        "Processing results",
        "Interviewing",
        "Under review",
        "Pending review",
    ].includes(label);
}

export function isCompletedDashboardStatus(
    label: CandidateDisplayStatus
): boolean {
    return label === "Interview completed";
}

export function isRealtimeInterviewStatus(
    latestInterviewStatus: CandidateInterviewStatus
): boolean {
    return (
        latestInterviewStatus === "IN_PROGRESS" ||
        latestInterviewStatus === "PROCESSING"
    );
}
