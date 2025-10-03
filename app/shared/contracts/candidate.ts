import { z } from "zod";

/**
 * Candidate API contracts (shared client/server)
 *
 * Purpose
 * - Define the minimal, mode-driven request contract for the candidate endpoint
 * - Provide reusable schemas for code-edit structures with strict range invariants
 *
 * Key Schemas
 * - RangeSchema: non-negative indices with start <= end
 * - CodeEditSchema: single-file, in-place replacement
 * - ContextSchema: current editor file text and metadata (version/hash)
 * - RequestSchema: { context, history, mode?, utterance? }
 *
 * Notes
 * - No response schema here; responses are channel-specific (text OR codeEdits)
 * - Keep this minimal and stable; import wherever validation is needed
 */

export const RangeSchema = z
    .object({
        start: z.number().int().nonnegative(),
        end: z.number().int().nonnegative(),
    })
    .refine((r) => r.start <= r.end, {
        message: "range.start must be <= range.end",
    });

export const CodeEditSchema = z.object({
    file: z.string().min(1),
    range: RangeSchema,
    replacement: z.string(),
});

export const ContextSchema = z.object({
    file: z.string(),
    versionId: z.string(),
    beforeHash: z.string(),
    text: z.string().optional(),
    slices: z
        .array(
            z.object({
                range: RangeSchema,
                text: z.string(),
            })
        )
        .optional(),
    outline: z.string().optional(),
});

export const ControlsSchema = z.object({
    allowCodeEdits: z.boolean().optional(),
});

export const RequestSchema = z.object({
    context: ContextSchema,
    history: z
        .array(
            z.object({
                role: z.enum(["candidate", "interviewer"]).optional(),
                text: z.string(),
            })
        )
        .default([]),
    mode: z.enum(["chat", "code"]).optional(),
    utterance: z.string().optional(),
});

export type CodeEdit = z.infer<typeof CodeEditSchema>;
export type CandidateContext = z.infer<typeof ContextSchema>;
