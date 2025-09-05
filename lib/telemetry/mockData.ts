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
        },
        {
            severity: "Minor",
            description: "Limited test coverage for edge cases",
            color: "yellow",
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
    },
    {
        id: "chapter2",
        title: "UserList Component Development",
        startTime: 75, // 1:15
        endTime: 165, // 2:45
        description:
            "Building the UserList component with API integration and styling",
        thumbnailUrl: "/mock/chapter2.jpg",
    },
    {
        id: "chapter3",
        title: "Counter Component Debugging",
        startTime: 165, // 2:45
        endTime: 260, // 4:20
        description:
            "Debugging the state management issue in the Counter component",
        thumbnailUrl: "/mock/chapter3.jpg",
    },
    {
        id: "chapter4",
        title: "Testing & Final Polish",
        startTime: 260, // 4:20
        endTime: 330, // 5:30
        description: "Final testing, code cleanup, and session wrap-up",
        thumbnailUrl: "/mock/chapter4.jpg",
    },
];

export const galWorkstyle: WorkstyleMetrics = {
    iterationSpeed: {
        value: 85,
        level: "High",
        color: "blue",
    },
    debugLoops: {
        value: 90,
        level: "Fast",
        color: "blue",
    },
    refactorCleanups: {
        value: 88,
        level: "Strong",
        color: "blue",
    },
    aiAssistUsage: {
        value: 15,
        level: "Minimal",
        color: "white",
        isFairnessFlag: false,
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
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    }
    return `${secs}s`;
};
