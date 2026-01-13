/**
 * Zod schemas and parsers for job category payloads.
 */
import { z } from "zod";

const codingCategorySchema = z
    .object({
        name: z.string(),
        description: z.string(),
        weight: z.number(),
    })
    .strict();

const experienceCategorySchema = z
    .object({
        name: z.string(),
        description: z.string(),
        example: z.string(),
        weight: z.number(),
    })
    .strict();

const codingCategoriesSchema = z.array(codingCategorySchema);
const experienceCategoriesSchema = z.array(experienceCategorySchema);

export type CodingCategory = z.infer<typeof codingCategorySchema>;
export type ExperienceCategory = z.infer<typeof experienceCategorySchema>;

/**
 * Predefined coding category present for every job.
 */
export const PREDEFINED_PROBLEM_SOLVING: CodingCategory = {
    name: "Problem Solving",
    description: "Approach to breaking down problems, algorithmic thinking, solution design",
    weight: 0, // Weight gets recalculated when merged with job-specific categories
};

/**
 * Merges predefined Problem Solving category with job-specific categories.
 * Recalculates weights so all categories sum to 25 (since AI Assist = 75%).
 */
export function mergeWithPredefinedCategories(customCategories: CodingCategory[] | null): CodingCategory[] {
    const CATEGORY_TOTAL_WEIGHT = 25; // Categories are 25% of coding score (AI Assist is 75%)
    
    if (!customCategories || customCategories.length === 0) {
        return [{ ...PREDEFINED_PROBLEM_SOLVING, weight: CATEGORY_TOTAL_WEIGHT }];
    }
    
    const totalCategories = customCategories.length + 1;
    const equalWeight = CATEGORY_TOTAL_WEIGHT / totalCategories;
    
    return [
        { ...PREDEFINED_PROBLEM_SOLVING, weight: equalWeight },
        ...customCategories.map(cat => ({ ...cat, weight: equalWeight }))
    ];
}

/**
 * Validates coding categories input for job APIs.
 */
export function parseCodingCategories(value: unknown): CodingCategory[] | null {
    if (value === null || value === undefined) return null;
    const parsed = codingCategoriesSchema.safeParse(value);
    if (!parsed.success) {
        throw new Error("Coding categories are invalid");
    }
    return parsed.data;
}

/**
 * Validates experience categories input for job APIs.
 */
export function parseExperienceCategories(value: unknown): ExperienceCategory[] | null {
    if (value === null || value === undefined) return null;
    const parsed = experienceCategoriesSchema.safeParse(value);
    if (!parsed.success) {
        throw new Error("Experience categories are invalid");
    }
    return parsed.data;
}

/**
 * Validates category generation responses from OpenAI.
 */
export const categoryGenerationSchema = z
    .object({
        codingCategories: codingCategoriesSchema,
        experienceCategories: experienceCategoriesSchema,
        jobFields: z
            .object({
                title: z.string().optional(),
                location: z.string().optional(),
                type: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT"]).optional(),
                salary: z.string().optional(),
                requirements: z.string().optional(),
            })
            .optional(),
        interviewContent: z
            .object({
                backgroundQuestion: z.string().optional(),
                codingPrompt: z.string().optional(),
                codingTemplate: z.string().optional(),
                codingAnswer: z.string().optional(),
                expectedOutput: z.string().optional(),
                codingLanguage: z.string().optional(),
            })
            .optional(),
    })
    .strict();
