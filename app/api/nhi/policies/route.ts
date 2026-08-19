import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from 'app/shared/services/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const INITIAL_POLICIES = [
  {
    id: "pol-01",
    agentName: "AI Candidate Screener Bot",
    agentType: "SCREENER_BOT",
    allowedIntents: ["candidates:read", "evaluations:write", "telemetry:read"],
    restrictedPaths: ["/api/admin/system-secrets", "/api/billing/*", "/api/database/drop"],
    maxTtlMinutes: 15,
    isEnforced: true,
    description: "Restricts autonomous candidate screening bot to non-administrative submission endpoints with 15m JIT tokens."
  },
  {
    id: "pol-02",
    agentName: "OpenAI Model Evaluator Service",
    agentType: "EVALUATOR_SERVICE",
    allowedIntents: ["models:read", "chat:completions"],
    restrictedPaths: ["/v1/organization/billing", "/v1/organization/members"],
    maxTtlMinutes: 60,
    isEnforced: true,
    description: "Limits automated model evaluation jobs to model inference without organization billing permissions."
  },
  {
    id: "pol-03",
    agentName: "Telemetry Exporter Agent",
    agentType: "EXPORTER_AGENT",
    allowedIntents: ["logs:read", "s3:put_object"],
    restrictedPaths: ["/api/users/*", "/api/credentials/*"],
    maxTtlMinutes: 30,
    isEnforced: true,
    description: "Scopes background audit log exporter strictly to S3 log upload bucket paths."
  }
];

/**
 * GET /api/nhi/policies - Fetches all agent intent policies from PostgreSQL
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as { role?: string })?.role;
    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    let policies = await prisma.agentIntentPolicy.findMany({
      orderBy: { createdAt: 'asc' }
    });

    if (policies.length === 0) {
      for (const pol of INITIAL_POLICIES) {
        await prisma.agentIntentPolicy.upsert({
          where: { id: pol.id },
          update: pol,
          create: pol
        });
      }
      policies = await prisma.agentIntentPolicy.findMany({
        orderBy: { createdAt: 'asc' }
      });
    }

    return NextResponse.json({ policies });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to fetch policies from PostgreSQL' }, { status: 500 });
  }
}

/**
 * PUT /api/nhi/policies - Updates an agent intent policy in PostgreSQL
 */
export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as { role?: string })?.role;
    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { id, isEnforced, allowedIntents, maxTtlMinutes, description } = body;

    if (!id) {
      return NextResponse.json({ error: 'Policy ID is required' }, { status: 400 });
    }

    const updatedPolicy = await prisma.agentIntentPolicy.update({
      where: { id },
      data: {
        ...(typeof isEnforced === 'boolean' && { isEnforced }),
        ...(Array.isArray(allowedIntents) && { allowedIntents }),
        ...(typeof maxTtlMinutes === 'number' && { maxTtlMinutes }),
        ...(typeof description === 'string' && { description })
      }
    });

    return NextResponse.json({ success: true, policy: updatedPolicy });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update policy in PostgreSQL' }, { status: 400 });
  }
}
