import { describe, expect, it } from "vitest";

import {
    deriveCandidateDisplayStatus,
    isActiveDashboardStatus,
    isCompletedDashboardStatus,
    isRealtimeInterviewStatus,
} from "./candidateDashboard";

describe("candidateDashboard status derivation", () => {
    it("prioritizes IN_PROGRESS over application state", () => {
        const status = deriveCandidateDisplayStatus("ACCEPTED", "IN_PROGRESS");
        expect(status.label).toBe("Interview in progress");
    });

    it("prioritizes PROCESSING over completed or reviewed states", () => {
        const status = deriveCandidateDisplayStatus("REVIEWED", "PROCESSING");
        expect(status.label).toBe("Processing results");
    });

    it("maps accepted applications when no active interview exists", () => {
        const status = deriveCandidateDisplayStatus("ACCEPTED", "COMPLETED");
        expect(status.label).toBe("Accepted");
        expect(status.isFinal).toBe(true);
    });

    it("maps rejected applications when no active interview exists", () => {
        const status = deriveCandidateDisplayStatus("REJECTED", null);
        expect(status.label).toBe("Not selected");
        expect(status.isFinal).toBe(true);
    });

    it("maps completed interviews before review state fallback", () => {
        const status = deriveCandidateDisplayStatus("PENDING", "COMPLETED");
        expect(status.label).toBe("Interview completed");
    });

    it("falls back to under review and pending review from application state", () => {
        expect(deriveCandidateDisplayStatus("REVIEWED", null).label).toBe(
            "Under review"
        );
        expect(deriveCandidateDisplayStatus("PENDING", null).label).toBe(
            "Pending review"
        );
    });
});

describe("candidateDashboard status helpers", () => {
    it("classifies active dashboard states", () => {
        expect(isActiveDashboardStatus("Pending review")).toBe(true);
        expect(isActiveDashboardStatus("Interview completed")).toBe(false);
    });

    it("classifies completed dashboard states", () => {
        expect(isCompletedDashboardStatus("Interview completed")).toBe(true);
        expect(isCompletedDashboardStatus("Accepted")).toBe(false);
    });

    it("detects realtime interview statuses", () => {
        expect(isRealtimeInterviewStatus("IN_PROGRESS")).toBe(true);
        expect(isRealtimeInterviewStatus("PROCESSING")).toBe(true);
        expect(isRealtimeInterviewStatus("COMPLETED")).toBe(false);
    });
});
