/**
 * Unit tests for extractTopHighlights utility.
 *
 * This function is shared by both per-job applicants and all-applicants API
 * routes to extract the top 2-3 category names from a session's telemetry.
 */

import { describe, it, expect } from "vitest";
import { extractTopHighlights } from "./highlightUtils";

describe("extractTopHighlights", () => {
    it("returns empty array when session is null", () => {
        expect(extractTopHighlights(null)).toEqual([]);
    });

    it("returns empty array when session is undefined", () => {
        expect(extractTopHighlights(undefined)).toEqual([]);
    });

    it("returns empty array when telemetryData is null", () => {
        expect(extractTopHighlights({ telemetryData: null })).toEqual([]);
    });

    it("returns empty array when telemetryData is empty array", () => {
        expect(extractTopHighlights({ telemetryData: [] })).toEqual([]);
    });

    it("wraps single telemetryData object into array", () => {
        const session = {
            telemetryData: {
                backgroundSummary: {
                    experienceCategories: {
                        react: { name: "React", score: 80 },
                    },
                },
            },
        };
        expect(extractTopHighlights(session)).toEqual(["React"]);
    });

    it("returns top 3 categories sorted by score descending", () => {
        const session = {
            telemetryData: {
                backgroundSummary: {
                    experienceCategories: {
                        a: { name: "Low", score: 20 },
                        b: { name: "High", score: 90 },
                        c: { name: "Mid", score: 50 },
                        d: { name: "VeryHigh", score: 95 },
                        e: { name: "MidHigh", score: 70 },
                    },
                },
            },
        };
        expect(extractTopHighlights(session)).toEqual(["VeryHigh", "High", "MidHigh"]);
    });

    it("returns fewer than 3 when fewer categories exist", () => {
        const session = {
            telemetryData: {
                backgroundSummary: {
                    experienceCategories: {
                        a: { name: "React", score: 80 },
                        b: { name: "Node", score: 60 },
                    },
                },
            },
        };
        expect(extractTopHighlights(session)).toEqual(["React", "Node"]);
    });

    it("merges experience and coding categories sorted together", () => {
        const session = {
            telemetryData: {
                backgroundSummary: {
                    experienceCategories: {
                        exp: { name: "Experience A", score: 70 },
                    },
                },
                codingSummary: {
                    jobSpecificCategories: {
                        code: { name: "Coding A", score: 90 },
                    },
                },
            },
        };
        expect(extractTopHighlights(session)).toEqual(["Coding A", "Experience A"]);
    });

    it("uses key as name fallback when value.name is missing", () => {
        const session = {
            telemetryData: {
                backgroundSummary: {
                    experienceCategories: {
                        react_hooks: { score: 80 },
                    },
                },
            },
        };
        expect(extractTopHighlights(session)).toEqual(["react_hooks"]);
    });

    it("skips entries where score is null", () => {
        const session = {
            telemetryData: {
                backgroundSummary: {
                    experienceCategories: {
                        a: { name: "Valid", score: 50 },
                        b: { name: "Null Score", score: null },
                    },
                },
            },
        };
        expect(extractTopHighlights(session)).toEqual(["Valid"]);
    });

    it("includes entries where score is 0 (0 != null)", () => {
        const session = {
            telemetryData: {
                backgroundSummary: {
                    experienceCategories: {
                        a: { name: "Zero", score: 0 },
                    },
                },
            },
        };
        expect(extractTopHighlights(session)).toEqual(["Zero"]);
    });

    it("works with only coding categories (no background)", () => {
        const session = {
            telemetryData: {
                codingSummary: {
                    jobSpecificCategories: {
                        py: { name: "Python", score: 85 },
                        algo: { name: "Algorithms", score: 60 },
                    },
                },
            },
        };
        expect(extractTopHighlights(session)).toEqual(["Python", "Algorithms"]);
    });

    it("works with only background categories (no coding)", () => {
        const session = {
            telemetryData: {
                backgroundSummary: {
                    experienceCategories: {
                        dl: { name: "Deep Learning", score: 75 },
                    },
                },
            },
        };
        expect(extractTopHighlights(session)).toEqual(["Deep Learning"]);
    });
});
