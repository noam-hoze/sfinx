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

// Role configuration for conversation participants
export interface RoleConfig {
    interviewer: "elevenLabs" | "human";
    candidate: "elevenLabs" | "human" | "openai";
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
    debugLoops: {
        value: number; // 0-100
        level: "Fast" | "Moderate" | "Slow";
        color: "blue" | "yellow" | "red";
        // Lower is better for debug loops. Benchmark of TPE (0-100).
        tpe?: number;
        evidenceLinks?: number[];
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

// Candidate Characteristics (1-5 scale)
export interface CandidateCharacteristics {
    independence: 1 | 2 | 3 | 4 | 5;
    creativity: 1 | 2 | 3 | 4 | 5;
    testingCode: 1 | 2 | 3 | 4 | 5;
    documenting: 1 | 2 | 3 | 4 | 5;
    speed: 1 | 2 | 3 | 4 | 5;
    thoroughness: 1 | 2 | 3 | 4 | 5;
    collaboration: 1 | 2 | 3 | 4 | 5;
    problemSolving: 1 | 2 | 3 | 4 | 5;
}

export type CharacteristicLevel = 1 | 2 | 3 | 4 | 5;

export type CandidateCharacteristicDescriptions = Record<
    keyof CandidateCharacteristics,
    Record<CharacteristicLevel, string>
>;

export const CANDIDATE_CHARACTERISTIC_DESCRIPTIONS: CandidateCharacteristicDescriptions =
    {
        independence: {
            1: "Needs constant guidance to progress",
            2: "Handles simple tasks with supervision",
            3: "Works alone on familiar problems",
            4: "Self-driven and proactive in resolving blockers",
            5: "Operates fully autonomously and mentors others",
        },
        creativity: {
            1: "Follows patterns without deviation",
            2: "Occasionally suggests minor tweaks",
            3: "Combines known ideas into new ones",
            4: "Frequently produces fresh, effective solutions",
            5: "Consistently invents original and elegant approaches",
        },
        testingCode: {
            1: "Rarely tests, relies on others to find bugs",
            2: "Tests only when errors occur",
            3: "Writes basic unit tests when prompted",
            4: "Actively tests edge cases and integrations",
            5: "Designs robust, automated test coverage",
        },
        documenting: {
            1: "Leaves code undocumented",
            2: "Adds minimal notes when required",
            3: "Documents main logic clearly",
            4: "Maintains consistent, structured documentation",
            5: "Produces exemplary, teachable documentation",
        },
        speed: {
            1: "Works slowly, struggles to deliver",
            2: "Completes simple tasks at a steady pace",
            3: "Balanced between speed and quality",
            4: "Delivers fast without major trade-offs",
            5: "Exceptionally quick and efficient under pressure",
        },
        thoroughness: {
            1: "Misses key details",
            2: "Checks partial results",
            3: "Reviews own work for major errors",
            4: "Double-checks and validates all paths",
            5: "Anticipates issues and ensures bulletproof output",
        },
        collaboration: {
            1: "Struggles to work with others",
            2: "Communicates reactively",
            3: "Shares updates and feedback when asked",
            4: "Contributes actively to team flow",
            5: "Elevates group performance through clear, positive collaboration",
        },
        problemSolving: {
            1: "Gets stuck without direction",
            2: "Solves straightforward issues",
            3: "Breaks problems into workable parts",
            4: "Finds smart shortcuts and optimizations",
            5: "Masters complex challenges with elegant reasoning",
        },
    };

// Personality traits (1-5 scale)
export interface PersonalityTraits {
    confidence: 1 | 2 | 3 | 4 | 5;
    modesty: 1 | 2 | 3 | 4 | 5;
    curiosity: 1 | 2 | 3 | 4 | 5;
    emotionalAwareness: 1 | 2 | 3 | 4 | 5;
    communication: 1 | 2 | 3 | 4 | 5;
    calmnessUnderPressure: 1 | 2 | 3 | 4 | 5;
    gratitude: 1 | 2 | 3 | 4 | 5;
}

export type PersonalityTraitLevel = 1 | 2 | 3 | 4 | 5;

export type PersonalityTraitDescriptions = Record<
    keyof PersonalityTraits,
    Record<PersonalityTraitLevel, string>
>;

export const PERSONALITY_TRAIT_DESCRIPTIONS: PersonalityTraitDescriptions = {
    confidence: {
        1: "Hesitant, second-guesses every choice, overly cautious",
        2: "Careful, seeks reassurance before acting, mild nervousness",
        3: "Balanced confidence; calm, corrects mistakes without panic",
        4: "Assured and composed; speaks clearly, owns success and errors",
        5: "Strong self-belief; decisive, conviction without arrogance",
    },
    modesty: {
        1: "Overly self-promoting; brags about achievements",
        2: "Occasionally humble but eager to impress",
        3: "Balanced; acknowledges success, credits teamwork",
        4: "Naturally modest; honest about limits and growth",
        5: "Deep humility; downplays achievements, deflects praise gracefully",
    },
    curiosity: {
        1: "Passive; waits for orders, no initiative to learn",
        2: "Asks questions only when confused",
        3: "Seeks to understand the problem before acting",
        4: "Actively curious; insightful, concise clarifying questions",
        5: "Deeply inquisitive; explores context and implications",
    },
    emotionalAwareness: {
        1: "Flat affect; no visible emotional reactions",
        2: "Slight tension; rarely expresses feelings",
        3: "Subtle reactions to success or stress (smiles, sighs, nods)",
        4: "Authentic emotions appropriately (relief, gratitude, excitement)",
        5: "Deeply attuned; mirrors tone, empathetic and warm",
    },
    communication: {
        1: "Robotic/scripted; unnatural phrasing",
        2: "Stilted; overly formal or dry",
        3: "Clear and natural, slightly restrained",
        4: "Conversational, relatable, warm; real expressions",
        5: "Effortlessly human; dynamic tone, uses pauses/humor/emotion",
    },
    calmnessUnderPressure: {
        1: "Panics easily; freezes or over-apologizes",
        2: "Nervous but functional; small verbal fillers",
        3: "Keeps focus; regains balance after mistakes",
        4: "Steady tone/body language; adapts smoothly",
        5: "Unflappable; handles stress with poise and quiet confidence",
    },
    gratitude: {
        1: "Ungrateful or dismissive",
        2: "Says thanks only when reminded",
        3: "Says thank you when guided or praised",
        4: "Warmly appreciative; genuine without excess",
        5: "Deeply respectful; makes others feel valued",
    },
};
