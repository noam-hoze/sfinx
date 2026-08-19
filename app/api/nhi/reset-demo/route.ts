import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from 'app/shared/services/server';
import { PrismaClient } from '@prisma/client';
import { validateOpenAIKey, rotateOpenAIKeysViaAdminApi } from 'app/shared/services/openai-admin';

const prisma = new PrismaClient();

const INITIAL_IDENTITIES = [
  {
    id: "nhi-01",
    name: "openai-evaluator-api-key",
    keySuffix: "vIgA",
    type: "API_KEY",
    provider: "OpenAI",
    keyAgeDays: 142,
    owner: "unassigned",
    permissions: ["models:all", "chat:completions", "fine-tuning:*"],
    isOverPrivileged: true,
    riskSeverity: "HIGH",
    status: "ACTIVE",
    lastUsed: "2 mins ago"
  },
  {
    id: "nhi-02",
    name: "postgres-primary-db-service-account",
    keySuffix: "master-cred",
    type: "SERVICE_ACCOUNT",
    provider: "PostgreSQL",
    keyAgeDays: 185,
    owner: "devops-team",
    permissions: ["db:read", "db:write", "db:drop_table", "db:grant_roles"],
    isOverPrivileged: true,
    riskSeverity: "HIGH",
    status: "ACTIVE",
    lastUsed: "Just now"
  },
  {
    id: "nhi-03",
    name: "github-actions-deploy-key",
    keySuffix: "ci-deploy-key",
    type: "DEPLOY_KEY",
    provider: "GitHub",
    keyAgeDays: 45,
    owner: "ci-cd-automation",
    permissions: ["repo:read", "repo:write"],
    isOverPrivileged: false,
    riskSeverity: "LOW",
    status: "ACTIVE",
    lastUsed: "1 hour ago"
  },
  {
    id: "nhi-04",
    name: "sfinx-candidate-screener-bot",
    keySuffix: "jit-token-v2",
    type: "AGENT_CREDENTIAL",
    provider: "Internal",
    keyAgeDays: 12,
    owner: "ai-engineering",
    permissions: ["candidates:read", "evaluations:write"],
    isOverPrivileged: false,
    riskSeverity: "LOW",
    status: "ACTIVE",
    lastUsed: "Active JIT Token"
  },
  {
    id: "nhi-05",
    name: "aws-s3-logs-exporter-account",
    keySuffix: "s3-exporter-iam",
    type: "AWS_IAM_ROLE",
    provider: "AWS",
    keyAgeDays: 98,
    owner: "unassigned",
    permissions: ["s3:*"],
    isOverPrivileged: true,
    riskSeverity: "MEDIUM",
    status: "ACTIVE",
    lastUsed: "12 hours ago"
  }
];

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as { role?: string })?.role;
    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const adminKey = process.env.OPENAI_ADMIN_KEY || '';
    let currentKey = process.env.OPENAI_API_KEY || '';
    let keyCheck = await validateOpenAIKey(currentKey);

    // If key is invalid, revoked, or missing, programmatically create a real key via OpenAI Admin API
    if (!keyCheck.valid && adminKey) {
      console.log('🔄 Reset Demo: No valid OpenAI key found. Creating a real Service Account API key via OpenAI Admin API...');
      const created = await rotateOpenAIKeysViaAdminApi(adminKey);
      if (created.success && created.key) {
        currentKey = created.key;
      }
    }

    const last4 = currentKey.length >= 4 ? currentKey.slice(-4) : 'vIgA';

    for (const item of INITIAL_IDENTITIES) {
      const isOpenAI = item.provider === 'OpenAI';
      await prisma.machineIdentity.update({
        where: { id: item.id },
        data: {
          name: item.name,
          keyAgeDays: item.keyAgeDays,
          owner: item.owner,
          permissions: item.permissions,
          isOverPrivileged: item.isOverPrivileged,
          riskSeverity: item.riskSeverity,
          status: item.status,
          lastUsed: item.lastUsed,
          keySuffix: isOpenAI ? last4 : item.keySuffix
        }
      });
    }

    const updatedIdentities = await prisma.machineIdentity.findMany({
      orderBy: { createdAt: 'asc' }
    });

    const formatted = updatedIdentities.map((item) => {
      const isOpenAI = item.provider === 'OpenAI';
      const keySuffixToUse = isOpenAI ? last4 : item.keySuffix;
      return {
        ...item,
        name: isOpenAI ? `openai-evaluator-api-key (sk-...${keySuffixToUse})` : item.name
      };
    });

    return NextResponse.json({ success: true, identities: formatted });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to reset demo state' }, { status: 500 });
  }
}
