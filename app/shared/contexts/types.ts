export interface InterviewTask {
    id: string;
    title: string;
    description: string;
    requirements: string[];
    expectedSolution?: string;
    completed: boolean;
    started: boolean;
}

export interface InterviewState {
    currentTaskId: string | null;
    tasks: InterviewTask[];
    isActive: boolean;
    candidateName: string;
    startTime: Date | null;
    endTime: Date | null;
    // Editor state
    currentCode: string;
    // Submission state
    submission: string | null;
    // Conversation coordination (refactor support)
    isCodingStarted?: boolean;
    hasSubmitted?: boolean;
    contextUpdatesQueue?: string[];
    userMessagesQueue?: string[];
}

export interface InterviewMessage {
    id: string;
    type: "ai" | "user" | "system";
    content: string;
    timestamp: Date;
    taskId?: string;
    codeSnippet?: string;
}

export interface InterviewContextType {
    state: InterviewState;
    messages: InterviewMessage[];
    startInterview: () => void;
    endInterview: () => void;
    nextTask: () => void;
    addMessage: (message: InterviewMessage) => void;
    updateTaskStatus: (taskId: string, status: "started" | "completed") => void;
    getCurrentTask: () => InterviewTask | null;
}

export const NOAM_TASKS: InterviewTask[] = [
    {
        id: "task1-userlist",
        title: "Build UserList Component",
        description:
            "Build a React component called `UserList` that fetches users from https://jsonplaceholder.typicode.com/users and displays their name and email in a styled list.",
        requirements: [
            "Fetch data from the JSONPlaceholder API",
            "Display user names and emails",
            "Add proper loading and error states",
            "Style the list with appropriate spacing and typography",
            "Handle API errors gracefully",
        ],
        completed: false,
        started: false,
    },
];

// Telemetry/CPS (Candidate Profile Story) Types
export interface CandidateProfile {
    id: string;
    name: string;
    matchScore: number; // 0-100
    confidence: "High" | "Medium" | "Low";
    story: string; // Narrative summary of candidate's performance
}

export interface GapAnalysis {
    gaps: {
        severity: "Critical" | "Major" | "Minor";
        description: string;
        color: "red" | "yellow" | "green";
        evidenceLinks?: number[];
    }[];
}

export interface EvidenceClip {
    id: string;
    title: string;
    thumbnailUrl: string;
    duration: number; // in seconds
    description: string;
    startTime?: number; // for chapter navigation
}

export interface VideoCaption {
    text: string;
    startTime: number;
    endTime: number;
}

export interface VideoChapter {
    id: string;
    title: string;
    startTime: number; // in seconds
    endTime: number; // in seconds
    description: string;
    thumbnailUrl?: string;
    captions?: VideoCaption[];
}

export interface WorkstyleMetrics {
    iterationSpeed: {
        value: number; // 0-100
        level: "High" | "Moderate" | "Low";
        color: "blue" | "yellow" | "red";
        // Top Performing Engineer benchmark (0-100). Optional.
        tpe?: number;
        evidenceLinks?: number[]; // Array of video timestamps
    };
    refactorCleanups: {
        value: number; // 0-100
        level: "Strong" | "Moderate" | "Weak";
        color: "blue" | "yellow" | "red";
        // TPE benchmark (0-100)
        tpe?: number;
        evidenceLinks?: number[];
    };
    aiAssistUsage: {
        value: number; // 0-100
        level: "Minimal" | "Moderate" | "High";
        color: "white" | "yellow" | "red";
        isFairnessFlag: boolean;
        // Lower is generally better; optional benchmark target
        tpe?: number;
        evidenceLinks?: number[];
    };
}

export interface TelemetryData {
    candidate: CandidateProfile;
    gaps: GapAnalysis;
    evidence: EvidenceClip[];
    chapters: VideoChapter[];
    workstyle: WorkstyleMetrics;
    hasFairnessFlag: boolean;
}
