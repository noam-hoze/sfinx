import { z } from "zod";

export const GuidanceSchema = z
    .object({
        action: z
            .enum([
                "ask_followup",
                "hint",
                "pace_up",
                "pace_down",
                "topic_shift",
                "end",
            ])
            .optional(),
        topic: z.string().optional(),
        difficulty: z.enum(["decrease", "maintain", "increase"]).optional(),
        rationale: z.string().optional(),
    })
    .strict();

export const ScoringSchema = z
    .object({
        scores: z.record(z.number()).optional(),
        confidence: z.number().min(0).max(1).optional(),
        evidence: z.array(z.string()).optional(),
    })
    .strict();

export const HistoryTurnSchema = z.object({
    role: z.enum(["candidate", "interviewer", "twin"]),
    text: z.string(),
    ts: z.string().optional(),
});

export const RespondRequestSchema = z.object({
    interviewerId: z.string(),
    sessionId: z.string(),
    history: z.array(HistoryTurnSchema).default([]),
    candidateTurn: z.string(),
    controls: z.record(z.any()).optional(),
});

export type RespondRequest = z.infer<typeof RespondRequestSchema>;

// Candidate response (training mode)
export const CandidateEditSchema = z
    .object({
        file: z.string(),
        range: z.object({
            start: z.number().int().min(0),
            end: z.number().int().min(0),
        }),
        replacement: z.string(),
    })
    .strict();

export const CandidateRespondRequestSchema = z.object({
    sessionId: z.string(),
    context: z.object({
        file: z.string(),
        versionId: z.string(),
        beforeHash: z.string(),
        text: z.string().optional(),
        slices: z
            .array(
                z.object({
                    range: z.object({
                        start: z.number().int().min(0),
                        end: z.number().int().min(0),
                    }),
                    text: z.string(),
                })
            )
            .optional(),
        outline: z.string().optional(),
    }),
    history: z
        .array(
            z.object({
                role: z.enum(["interviewer", "candidate"]),
                text: z.string(),
            })
        )
        .default([]),
    controls: z
        .object({
            maxEdits: z.number().int().min(0).max(10).optional(),
            maxEditSize: z.number().int().min(0).max(5000).optional(),
        })
        .optional(),
});

export type CandidateRespondRequest = z.infer<
    typeof CandidateRespondRequestSchema
>;
