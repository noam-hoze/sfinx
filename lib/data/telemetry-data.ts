import {
    TelemetryData,
    CandidateProfile,
    GapAnalysis,
    EvidenceClip,
    VideoChapter,
    WorkstyleMetrics,
} from "../contexts/types";

// Mock data for Noam's Candidate Profile Story
export const noamProfile: CandidateProfile = {
    id: "noam-001",
    name: "Noam Hoze",
    matchScore: 82,
    confidence: "High",
    story: "The candidate shows strong fundamental React skills and a methodical approach to debugging. They successfully implemented the feature but missed handling asynchronous loading and error states, which is a key area for improvement.",
};

export const noamGaps: GapAnalysis = {
    gaps: [
        {
            severity: "Major",
            description: "Not handling loading and error state",
            color: "yellow",
            evidenceLinks: [],
        },
    ],
};

export const noamEvidence: EvidenceClip[] = [
    {
        id: "clip1",
        title: "Iteration Speed",
        thumbnailUrl: "/mock/clip1.jpg",
        duration: 7,
        description: "The user verifies that useState is working correctly.",
        startTime: 38,
    },
    {
        id: "clip2",
        title: "Iteration Speed",
        thumbnailUrl: "/mock/clip2.jpg",
        duration: 9,
        description: "The user checks if the list is displaying.",
        startTime: 127,
    },
    {
        id: "clip3",
        title: "Debug Loop Start",
        thumbnailUrl: "/mock/clip3.jpg",
        duration: 6,
        description:
            "The user checks if the list is displaying and gets an error.",
        startTime: 240,
    },
    {
        id: "clip4",
        title: "Debug Loop End",
        thumbnailUrl: "/mock/clip4.jpg",
        duration: 6,
        description: "The user fixes the error.",
        startTime: 260,
    },
];

export const noamChapters: VideoChapter[] = [
    {
        id: "chapter1",
        title: "Intro",
        startTime: 0,
        endTime: 18,
        description: "Session Introduction",
        thumbnailUrl: "/mock/chapter1.jpg",
        captions: [],
    },
    {
        id: "chapter2",
        title: "1st Iteration",
        startTime: 18,
        endTime: 40,
        description: "Implementing initial state.",
        thumbnailUrl: "/mock/chapter2.jpg",
        captions: [
            {
                text: "The user verifies that useState is working correctly",
                startTime: 38,
                endTime: 45,
            },
        ],
    },
    {
        id: "chapter3",
        title: "2nd Iteration",
        startTime: 40,
        endTime: 136,
        description: "Fetching and displaying data.",
        thumbnailUrl: "/mock/chapter3.jpg",
        captions: [
            {
                text: "The user checks if the list is displaying",
                startTime: 127,
                endTime: 136,
            },
        ],
    },
    {
        id: "chapter4",
        title: "3rd Iteration",
        startTime: 136,
        endTime: 245,
        description: "Debugging a display issue.",
        thumbnailUrl: "/mock/chapter4.jpg",
        captions: [
            {
                text: "The user checks if the list is displaying and gets an error",
                startTime: 240,
                endTime: 246,
            },
        ],
    },
    {
        id: "chapter5",
        title: "4th Iteration",
        startTime: 245,
        endTime: 282,
        description: "Finalizing the component.",
        thumbnailUrl: "/mock/chapter5.jpg",
        captions: [
            { text: "The user fixes the error", startTime: 260, endTime: 266 },
        ],
    },
];

export const noamWorkstyle: WorkstyleMetrics = {
    iterationSpeed: {
        value: 85,
        level: "High",
        color: "blue",
        evidenceLinks: [38, 127, 242],
    },
    debugLoops: {
        value: 10,
        level: "Fast",
        color: "blue",
        evidenceLinks: [240, 260],
    },
    refactorCleanups: {
        value: 100,
        level: "Strong",
        color: "blue",
        evidenceLinks: [],
    },
    aiAssistUsage: {
        value: 0,
        level: "Minimal",
        color: "white",
        isFairnessFlag: false,
        evidenceLinks: [],
    },
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
