import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { log } from "app/shared/services";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

type RouteContext = {
    params: Promise<{ sessionId?: string | string[] }>;
};

function normalizeSessionId(sessionId: string | string[] | undefined) {
    if (Array.isArray(sessionId)) {
        return sessionId[0] ?? "";
    }
    return sessionId ?? "";
}

/**
 * POST /api/interviews/session/[sessionId]/debug-loops
 * Creates a new debug loop record for the interview session.
 */
export async function POST(request: NextRequest, context: RouteContext) {
    try {
        log.info("[DEBUG LOOP API] POST request received");
        
        const { sessionId: rawSessionId } = await context.params;
        const sessionId = normalizeSessionId(rawSessionId);

        log.info("[DEBUG LOOP API] Session ID:", sessionId);

        if (!sessionId) {
            log.error("[DEBUG LOOP API] No session ID provided");
            return NextResponse.json(
                { error: "Session ID is required" },
                { status: 400 }
            );
        }

        const body = await request.json();
        log.info("[DEBUG LOOP API] Request body:", body);
        
        const { startTimestamp, endTimestamp, errorCount, resolved, caption } = body;

        if (!startTimestamp || !endTimestamp || errorCount === undefined || resolved === undefined || !caption) {
            log.error("[DEBUG LOOP API] Missing required fields");
            return NextResponse.json(
                { error: "Missing required fields: startTimestamp, endTimestamp, errorCount, resolved, caption" },
                { status: 400 }
            );
        }

        // Create debug loop
        log.info("[DEBUG LOOP API] Creating debug loop in DB...");
        
        const debugLoop = await prisma.debugLoop.create({
            data: {
                interviewSessionId: sessionId,
                startTimestamp: new Date(startTimestamp),
                endTimestamp: new Date(endTimestamp),
                errorCount: parseInt(errorCount, 10),
                resolved: Boolean(resolved),
                caption: String(caption),
            },
        });

        log.info("[DEBUG LOOP API] Debug loop created:", debugLoop.id);

        // Update WorkstyleMetrics.debugLoops counter
        log.info("[DEBUG LOOP API] Updating WorkstyleMetrics counter...");
        
        const telemetryData = await prisma.telemetryData.findUnique({
            where: { interviewSessionId: sessionId },
            include: { workstyleMetrics: true },
        });

        if (telemetryData) {
            log.info("[DEBUG LOOP API] TelemetryData found:", telemetryData.id);
            
            if (telemetryData.workstyleMetrics) {
                log.info("[DEBUG LOOP API] WorkstyleMetrics exists, incrementing...");
                await prisma.workstyleMetrics.update({
                    where: { id: telemetryData.workstyleMetrics.id },
                    data: {
                        debugLoops: {
                            increment: 1,
                        },
                    },
                });
                log.info("[DEBUG LOOP API] Counter incremented");
            } else {
                log.info("[DEBUG LOOP API] WorkstyleMetrics doesn't exist, creating...");
                await prisma.workstyleMetrics.create({
                    data: {
                        telemetryDataId: telemetryData.id,
                        debugLoops: 1,
                    },
                });
                log.info("[DEBUG LOOP API] WorkstyleMetrics created");
            }
        } else {
            log.warn("[DEBUG LOOP API] No TelemetryData found for session, skipping counter update");
        }

        log.info("[DEBUG LOOP API] ✅ Success! Returning response");

        return NextResponse.json({ debugLoop }, { status: 201 });
    } catch (error) {
        log.error("[DEBUG LOOP API] ❌ Error creating debug loop:", error);
        if (error instanceof Error) {
            log.error("[DEBUG LOOP API] Error message:", error.message);
            log.error("[DEBUG LOOP API] Error stack:", error.stack);
        }
        return NextResponse.json(
            { error: "Failed to create debug loop" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/interviews/session/[sessionId]/debug-loops
 * Fetches all debug loops for the interview session.
 */
export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const { sessionId: rawSessionId } = await context.params;
        const sessionId = normalizeSessionId(rawSessionId);

        if (!sessionId) {
            return NextResponse.json(
                { error: "Session ID is required" },
                { status: 400 }
            );
        }

        const debugLoops = await prisma.debugLoop.findMany({
            where: { interviewSessionId: sessionId },
            orderBy: { startTimestamp: "asc" },
        });

        return NextResponse.json({ debugLoops });
    } catch (error) {
        log.error("Error fetching debug loops:", error);
        return NextResponse.json(
            { error: "Failed to fetch debug loops" },
            { status: 500 }
        );
    }
}

