import { NextRequest, NextResponse } from "next/server";
import { logger } from "../../../shared/services";
import { runRespond } from "../../../shared/services/digital-twin/orchestrator";
import { RespondRequestSchema } from "../../../shared/services/digital-twin/schema";

const log = logger.for("@api/digital-twin/respond");

export async function POST(request: NextRequest) {
    const startedAt = Date.now();
    try {
        const json = await request.json();
        const parsed = RespondRequestSchema.safeParse(json);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid request", issues: parsed.error.issues },
                { status: 400 }
            );
        }

        const result = await runRespond(parsed.data);
        const latencyMs = Date.now() - startedAt;
        return NextResponse.json({ ...result, latencyMs });
    } catch (error: any) {
        log.error("/respond failed", {
            name: error?.name,
            message: error?.message,
            stack: error?.stack,
        });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
