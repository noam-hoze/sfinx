/**
 * Allowed video chapter types for interview sessions.
 * These are the ONLY valid chapter types that can be created.
 */
export const CHAPTER_TYPES = {
    PROBLEM_PRESENTATION: "Problem Presentation",
    ITERATION: "Iteration", // Will be suffixed with number: "Iteration 1", "Iteration 2", etc.
    EXTERNAL_TOOL_USAGE: "External Tool Usage",
} as const;

export type ChapterType = typeof CHAPTER_TYPES[keyof typeof CHAPTER_TYPES];

