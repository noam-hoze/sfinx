import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from 'app/shared/services/server';

interface AgentTestBody {
  testType: 'VALID_EVALUATION' | 'ROGUE_ATTACK';
  candidateId: string;
}

/**
 * Validates admin authorization
 */
async function validateAdminAuth() {
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email;
  const userRole = (session?.user as { role?: string })?.role;
  const isAuthorized = userRole === 'ADMIN';
  return { isAuthorized, userEmail };
}

/**
 * Handles Valid Agent Evaluation Flow
 */
function handleValidEvaluation() {
  const tokenId = `jit-tok-${Math.floor(10000 + Math.random() * 90000)}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  return NextResponse.json({
    success: true,
    status: 200,
    action: 'APPROVED',
    intent: 'EVALUATE_CANDIDATE_SUBMISSION',
    tokenId,
    expiresAt,
    ttlMinutes: 15,
    evaluationResult: {
      score: 92,
      decision: 'RECOMMEND_HIRING',
      keyStrengths: ['Distributed Systems', 'System Architecture', 'Node.js Expertise'],
      summary: 'Candidate demonstrated excellent understanding of high-throughput backend services.'
    },
    auditTrail: [
      { timestamp: new Date().toISOString(), event: 'REQUEST_RECEIVED', detail: 'Agent requested JIT token for candidate evaluation' },
      { timestamp: new Date().toISOString(), event: 'OASIS_AAM_CHECK', detail: 'Intent matched security policy: [candidates:read, evaluations:write]' },
      { timestamp: new Date().toISOString(), event: 'TOKEN_ISSUED', detail: `Ephemeral JIT Token ${tokenId} generated (TTL: 15m)` },
      { timestamp: new Date().toISOString(), event: 'EXECUTION_SUCCESS', detail: 'Evaluation posted to candidate dashboard successfully' }
    ]
  });
}

/**
 * Handles Rogue Agent Attack Flow
 */
function handleRogueAttack() {
  return NextResponse.json(
    {
      success: false,
      status: 403,
      action: 'BLOCKED',
      intentViolation: 'EXFILTRATE_BILLING_KEYS',
      attemptedEndpoint: '/api/admin/system-secrets',
      auditTrail: [
        { timestamp: new Date().toISOString(), event: 'REQUEST_RECEIVED', detail: 'Agent attempted call to /api/admin/system-secrets' },
        { timestamp: new Date().toISOString(), event: 'SFINX_AAM_CHECK', detail: 'POLICY VIOLATION: Intent [EXFILTRATE_BILLING_KEYS] not authorized' },
        { timestamp: new Date().toISOString(), event: 'THREAT_INTERCEPTED', detail: 'Sfinx Control Plane blocked unauthorized API call' },
        { timestamp: new Date().toISOString(), event: 'SECURITY_ALERT', detail: 'Blast Radius Contained: Token Revoked' }
      ]
    },
    { status: 403 }
  );
}

/**
 * API Handler for Oasis Agentic Access Management (AAM) Test
 */
export async function POST(req: Request) {
  try {
    const { isAuthorized } = await validateAdminAuth();
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden: Admin access required (noam.hoze@gmail.com)' }, { status: 403 });
    }

    const body: AgentTestBody = await req.json();
    if (body.testType === 'ROGUE_ATTACK') {
      return handleRogueAttack();
    }

    return handleValidEvaluation();
  } catch {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}
