import type { Prisma } from "@prisma/client";
import { buildInterviewUrl } from "app/shared/utils/interviewLinks";
import { mergeWithPredefinedCategories, type CodingCategory } from "./categorySchemas";

/**
 * Coerces mixed input (string or number) into a positive integer number of seconds.
 * Values ≤0 or unparsable fall back to the provided default.
 */
export function coerceSeconds(value: unknown, fallback: number): number {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        return Math.floor(value);
    }
    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed > 0) {
            return Math.floor(parsed);
        }
    }
    return fallback;
}

type JobWithCompany = Prisma.JobGetPayload<{
    include: { company: true; interviewContent: true };
}>;

/**
 * Normalizes Prisma job records into the shape consumed by the frontend JobGrid.
 */
export function mapJobResponse(
    job: JobWithCompany,
    company?: JobWithCompany["company"],
    origin?: string
) {
    const interview = job.interviewContent;
    const owningCompany = company ?? job.company;
    
    // Merge predefined Problem Solving with job-specific coding categories
    const customCodingCategories = job.codingCategories as CodingCategory[] | null;
    const mergedCodingCategories = mergeWithPredefinedCategories(customCodingCategories);
    
    return {
        id: job.id,
        title: job.title,
        location: job.location,
        type: job.type,
        description: job.description,
        salary: job.salary,
        requirements: job.requirements,
        codingCategories: mergedCodingCategories,
        experienceCategories: job.experienceCategories,
        interviewUrl:
            interview && owningCompany
                ? buildInterviewUrl(origin, owningCompany.id, job.id)
                : null,
        interviewContent: interview
            ? {
                  id: interview.id,
                  backgroundQuestion: interview.backgroundQuestion,
                  backgroundQuestionCategory: interview.backgroundQuestionCategory,
                  codingPrompt: interview.codingPrompt,
                  codingTemplate: interview.codingTemplate,
                  codingAnswer: interview.codingAnswer,
                  expectedOutput: interview.expectedOutput,
                  codingLanguage: interview.codingLanguage,
                  backgroundQuestionTimeSeconds:
                      interview.backgroundQuestionTimeSeconds,
                  codingQuestionTimeSeconds:
                      interview.codingQuestionTimeSeconds,
              }
            : null,
        company: owningCompany
            ? {
                  id: owningCompany.id,
                  name: owningCompany.name,
                  logo: owningCompany.logo,
                  industry: owningCompany.industry,
                  size: owningCompany.size,
              }
            : undefined,
    };
}
