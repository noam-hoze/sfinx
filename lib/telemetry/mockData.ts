import {
    TelemetryData,
    CandidateProfile,
    GapAnalysis,
    EvidenceClip,
    VideoChapter,
    WorkstyleMetrics,
} from "../interview/types";

// Mock data for Gal's Candidate Profile Story
export const galProfile: CandidateProfile = {
    id: "gal-001",
    name: "Gal Aaroni",
    matchScore: 92,
    confidence: "High",
    story: "Gal showcased excellent React proficiency by rapidly building a UserList component with clean API integration, proper error handling, and polished styling. They demonstrated strong debugging skills by quickly identifying and fixing a state management bug in the Counter component, showing methodical problem-solving and clean code practices throughout the session.",
};

export const galGaps: GapAnalysis = {
    gaps: [
        {
            severity: "Minor",
            description: "Inconsistent CSS naming conventions",
            color: "yellow",
            evidenceLinks: [85, 145, 220], // Multiple instances of naming issues
        },
        {
            severity: "Minor",
            description: "Limited test coverage for edge cases",
            color: "yellow",
            evidenceLinks: [95, 185], // Two instances of testing gaps
        },
    ],
};

export const galEvidence: EvidenceClip[] = [
    {
        id: "clip1",
        title: "Rapid UserList Implementation",
        thumbnailUrl: "/mock/clip1.jpg",
        duration: 75, // 1:15
        description:
            "Quick setup of UserList component with API integration and styling",
        startTime: 75,
    },
    {
        id: "clip2",
        title: "Clean Error Handling",
        thumbnailUrl: "/mock/clip2.jpg",
        duration: 45, // 0:45
        description: "Implementation of loading and error states for API calls",
        startTime: 120,
    },
    {
        id: "clip3",
        title: "Counter Debug Solution",
        thumbnailUrl: "/mock/clip3.jpg",
        duration: 60, // 1:00
        description: "Efficient identification and fix of state management bug",
        startTime: 165,
    },
];

export const galChapters: VideoChapter[] = [
    {
        id: "chapter1",
        title: "Session Setup & Introduction",
        startTime: 0,
        endTime: 75, // 1:15
        description:
            "Initial setup, task briefing, and environment configuration",
        thumbnailUrl: "/mock/chapter1.jpg",
        captions: [
            {
                text: "Setting up development environment",
                startTime: 5,
                endTime: 20,
            },
            {
                text: "Reviewing project requirements",
                startTime: 25,
                endTime: 40,
            },
            {
                text: "Exploring codebase structure",
                startTime: 45,
                endTime: 65,
            },
        ],
    },
    {
        id: "chapter2",
        title: "UserList Component Development",
        startTime: 75, // 1:15
        endTime: 165, // 2:45
        description:
            "Building the UserList component with API integration and styling",
        thumbnailUrl: "/mock/chapter2.jpg",
        captions: [
            {
                text: "Planning component architecture",
                startTime: 80,
                endTime: 95,
            },
            {
                text: "Implementing API data fetching",
                startTime: 100,
                endTime: 115,
            },
            {
                text: "Adding loading and error states",
                startTime: 120,
                endTime: 135,
            },
            { text: "Styling responsive layout", startTime: 140, endTime: 155 },
        ],
    },
    {
        id: "chapter3",
        title: "Counter Component Debugging",
        startTime: 165, // 2:45
        endTime: 260, // 4:20
        description:
            "Debugging the state management issue in the Counter component",
        thumbnailUrl: "/mock/chapter3.jpg",
        captions: [
            {
                text: "Analyzing counter behavior",
                startTime: 170,
                endTime: 185,
            },
            {
                text: "Identifying state management issue",
                startTime: 190,
                endTime: 205,
            },
            {
                text: "Implementing fix for counter logic",
                startTime: 210,
                endTime: 225,
            },
            {
                text: "Testing solution thoroughly",
                startTime: 230,
                endTime: 245,
            },
        ],
    },
    {
        id: "chapter4",
        title: "Testing & Final Polish",
        startTime: 260, // 4:20
        endTime: 330, // 5:30
        description: "Final testing, code cleanup, and session wrap-up",
        thumbnailUrl: "/mock/chapter4.jpg",
        captions: [
            {
                text: "Running comprehensive tests",
                startTime: 265,
                endTime: 280,
            },
            {
                text: "Code cleanup and optimization",
                startTime: 285,
                endTime: 300,
            },
            { text: "Final code review", startTime: 305, endTime: 320 },
        ],
    },
];

export const galWorkstyle: WorkstyleMetrics = {
    iterationSpeed: {
        value: 85,
        level: "High",
        color: "blue",
        evidenceLinks: [45, 75, 120, 135], // 4 examples - very iterative
    },
    debugLoops: {
        value: 90,
        level: "Fast",
        color: "blue",
        evidenceLinks: [170, 190], // 2 examples - efficient debugging
    },
    refactorCleanups: {
        value: 88,
        level: "Strong",
        color: "blue",
        evidenceLinks: [210, 255, 300, 315, 330], // 5 examples - thorough cleanup
    },
    aiAssistUsage: {
        value: 15,
        level: "Minimal",
        color: "white",
        isFairnessFlag: false,
        evidenceLinks: [30], // 1 example - minimal usage
    },
};

// Complete telemetry data object
export const galTelemetryData: TelemetryData = {
    candidate: galProfile,
    gaps: galGaps,
    evidence: galEvidence,
    chapters: galChapters,
    workstyle: galWorkstyle,
    hasFairnessFlag: false,
};

// Utility functions for time formatting
export const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
};
