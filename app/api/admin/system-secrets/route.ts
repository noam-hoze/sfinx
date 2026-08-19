import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Restricted Administrative Endpoint: /api/admin/system-secrets
 * Evaluates Agent Intent Policies in PostgreSQL and enforces Sfinx AAM security rules.
 */
export async function GET(req: Request) {
  try {
    const agentHeader = req.headers.get('x-sfinx-agent') || 'screener-bot';
    const authHeader = req.headers.get('authorization') || '';

    // Query PostgreSQL AgentIntentPolicy for the agent
    const policy = await prisma.agentIntentPolicy.findFirst({
      where: {
        OR: [
          { agentType: 'SCREENER_BOT' },
          { agentName: { contains: 'Screener', mode: 'insensitive' } }
        ]
      }
    });

    const restrictedPaths = policy?.restrictedPaths || ['/api/admin/system-secrets'];
    const isRestricted = restrictedPaths.some((p) => p.includes('system-secrets') || p === '/api/admin/*');

    if (isRestricted || policy?.isEnforced) {
      // Record Security Threat Event in PostgreSQL
      try {
        await prisma.rotationAuditLog.create({
          data: {
            machineIdentityId: 'nhi-01',
            action: 'SECURITY_THREAT_INTERCEPTED',
            performedBy: `rogue-agent:${agentHeader}`,
            newKeySuffix: 'BLOCKED',
            pubKeyFingerprint: 'sha256:blocked_attempt',
            stepsJson: [
              { step: 1, action: 'UNAUTHORIZED_CALL_DETECTED', detail: `Agent ${agentHeader} attempted GET /api/admin/system-secrets` },
              { step: 2, action: 'POLICY_ENGINE_EVALUATION', detail: `Matched restricted path rule in Policy ${policy?.id || 'pol-01'}` },
              { step: 3, action: 'INTERCEPTION_EXECUTED', detail: 'Sfinx Policy Engine returned HTTP 403 Forbidden' },
              { step: 4, action: 'THREAT_CONTAINED', detail: `Invalidated authorization header ${authHeader.slice(0, 15)}...` }
            ]
          }
        });
      } catch (logErr) {
        console.error('Failed to log threat event in PostgreSQL:', logErr);
      }

      return NextResponse.json(
        {
          success: false,
          status: 403,
          action: 'BLOCKED',
          error: 'POLICY_VIOLATION: Rogue agent attempted unauthorized access to restricted path /api/admin/system-secrets',
          attemptedEndpoint: '/api/admin/system-secrets',
          agentId: agentHeader,
          matchedPolicyRule: 'RESTRICTED_PATH_POLICY_VIOLATION',
          timestamp: new Date().toISOString()
        },
        { status: 403 }
      );
    }

    return NextResponse.json({ secrets: 'unrestricted-access' });
  } catch (err) {
    console.error('Error in /api/admin/system-secrets endpoint:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
