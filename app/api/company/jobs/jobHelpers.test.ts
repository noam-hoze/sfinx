import { describe, expect, it } from "vitest";
import { mapJobResponse } from "./jobHelpers";

function makeJob(scoringConfiguration: any) {
    return {
        id: "job-1",
        title: "Backend Engineer",
        location: "Remote",
        type: "FULL_TIME",
        description: null,
        salary: null,
        requirements: null,
        codingCategories: null,
        experienceCategories: null,
        interviewContent: null,
        company: {
            id: "company-1",
            name: "Acme",
            logo: null,
            industry: null,
            size: null,
        },
        scoringConfiguration,
    } as any;
}

describe("mapJobResponse", () => {
    it("returns the stored scoring config when one exists", () => {
        const scoringConfig = {
            aiAssistWeight: 30,
            problemSolvingWeight: 20,
            experienceWeight: 40,
            codingWeight: 60,
        };

        const result = mapJobResponse(makeJob(scoringConfig));

        expect(result.scoringConfig).toEqual(scoringConfig);
    });

    it("returns the default scoring config when none exists", () => {
        const result = mapJobResponse(makeJob(null));

        expect(result.scoringConfig).toEqual({
            aiAssistWeight: 25,
            problemSolvingWeight: 25,
            experienceWeight: 50,
            codingWeight: 50,
        });
    });
});
