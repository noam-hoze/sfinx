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
