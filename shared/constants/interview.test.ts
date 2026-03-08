import { describe, expect, it } from "vitest";
import {
    CREATION_BACKGROUND_CONTRIBUTIONS_TARGET,
    CREATION_CODING_CONTRIBUTIONS_TARGET,
    requireBackgroundContributionsTarget,
    requireCodingContributionsTarget,
} from "./interview";

describe("interview contribution target helpers", () => {
    it("returns persisted targets when they are present", () => {
        const config = {
            backgroundContributionsTarget: 7,
            codingContributionsTarget: 9,
        };

        expect(requireBackgroundContributionsTarget(config, "test job")).toBe(7);
        expect(requireCodingContributionsTarget(config, "test job")).toBe(9);
    });

    it("throws when scoring configuration is missing", () => {
        expect(() => requireBackgroundContributionsTarget(null, "job 123")).toThrow(
            "Missing scoring configuration for job 123"
        );
    });

    it("throws when persisted targets are invalid", () => {
        expect(() =>
            requireCodingContributionsTarget(
                { backgroundContributionsTarget: 5, codingContributionsTarget: 0 },
                "job 456"
            )
        ).toThrow("Missing valid codingContributionsTarget for job 456");
    });

    it("keeps creation defaults explicit and stable", () => {
        expect(CREATION_BACKGROUND_CONTRIBUTIONS_TARGET).toBe(5);
        expect(CREATION_CODING_CONTRIBUTIONS_TARGET).toBe(5);
    });
});
