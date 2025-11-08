import type { Prisma } from "@prisma/client";

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
export function mapJobResponse(job: JobWithCompany, company?: JobWithCompany["company"]) {
    const interview = job.interviewContent;
    const owningCompany = company ?? job.company;
    return {
        id: job.id,
        title: job.title,
        location: job.location,
        type: job.type,
        description: job.description,
        salary: job.salary,
        requirements: job.requirements,
        interviewContent: interview
            ? {
                  id: interview.id,
                  backgroundQuestion: interview.backgroundQuestion,
                  codingPrompt: interview.codingPrompt,
                  codingTemplate: interview.codingTemplate,
                  codingAnswer: interview.codingAnswer,
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

