/**
 * Candidate Respond API
 *
 * POST /api/candidate/respond
 * - Auth: COMPANY or ADMIN
 * - Request: { context, history, mode?, utterance? }
 * - Behavior:
 *   - mode=chat → returns { text }
 *   - mode=code → returns { codeEdits[] }
 * - Invariants: one channel per turn (never both)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth/next";
import { authOptions } from "app/shared/services/auth";
import { logger } from "app/shared/services";
import {
    generateCandidateReply as candidateGenerateReply,
    generateCodeEdits as candidateGenerateCodeEdits,
} from "app/shared/services/candidateAgent";
import { RequestSchema } from "app/shared/contracts/candidate";

export async function POST(request: NextRequest) {
    const log = logger.for("@api/candidate/respond");
    // Ensure logger picks up latest env flags on each request in dev
    try {
        logger.refresh();
    } catch {}
    const session = (await getServerSession(authOptions)) as any;
    const role = session?.user?.role as string | undefined;
    if (!session || (role !== "ADMIN" && role !== "COMPANY")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    const parsed = RequestSchema.safeParse(json);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid request", issues: parsed.error.issues },
            { status: 400 }
        );
    }

    const { context } = parsed.data as any;
    const mode: "chat" | "code" = (parsed.data.mode as any) ?? "chat";
    const utterance = (parsed.data.utterance || "").trim();

    if (mode === "code") {
        log.info("mode=code", {
            file: context?.file,
            textLen: context?.text?.length || 0,
            versionId: context?.versionId,
        });
        // Best-effort task/plan from rolling history
        const hist = parsed.data.history || [];
        const lastInterviewer = [...hist]
            .reverse()
            .find((t) => t?.role !== "candidate");
        const lastCandidate = [...hist]
            .reverse()
            .find((t) => t?.role === "candidate");
        const task = lastInterviewer?.text || "";
        const plan = lastCandidate?.text || "";
        const edits = await candidateGenerateCodeEdits(
            context as any,
            hist as any,
            task,
            plan
        );
        log.info("codeEdits", {
            count: edits.length,
        });
        return NextResponse.json({
            ok: true,
            respondWithCandidate: { codeEdits: edits },
        });
    } else {
        log.info("mode=chat", {
            utteranceLen: utterance.length,
            history: (parsed.data.history || []).length,
            file: context?.file,
            textLen: context?.text?.length || 0,
        });
        const reply = await candidateGenerateReply(
            utterance,
            parsed.data.history || [],
            context as any
        );
        log.info("chat reply len", {
            replyLen: reply?.length || 0,
        });
        return NextResponse.json({
            ok: true,
            respondWithCandidate: { text: reply, codeEdits: [] },
        });
    }
}
