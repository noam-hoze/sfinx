import { describe, expect, it } from "vitest";
import {
    DEFAULT_SCORING_CONFIG_VALUES,
    buildScoringConfigValues,
    validateScoringConfigInput,
} from "./scoringConfigHelpers";

describe("scoringConfigHelpers", () => {
    it("uses explicit creation defaults when no input is provided", () => {
        expect(buildScoringConfigValues()).toEqual(DEFAULT_SCORING_CONFIG_VALUES);
    });

    it("validates positive integer contribution targets", () => {
        expect(
            validateScoringConfigInput({ backgroundContributionsTarget: 0 })
        ).toBe("backgroundContributionsTarget must be a positive integer");
    });

    it("applies valid contribution target overrides", () => {
        expect(
            buildScoringConfigValues({
                backgroundContributionsTarget: 8,
                codingContributionsTarget: 6,
            })
        ).toMatchObject({
            backgroundContributionsTarget: 8,
            codingContributionsTarget: 6,
        });
    });
});
