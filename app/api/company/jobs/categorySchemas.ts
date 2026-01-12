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
    })
    .strict();
