import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedNHI() {
  console.log('🌱 Seeding PostgreSQL MachineIdentity and AgentIntentPolicy tables...');

  const initialIdentities = [
    {
      id: "nhi-01",
      name: "openai-evaluator-api-key",
      keySuffix: "BToA",
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

  for (const item of initialIdentities) {
    await prisma.machineIdentity.upsert({
      where: { id: item.id },
      update: item,
      create: item
    });
  }

  const initialPolicies = [
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

  for (const pol of initialPolicies) {
    await prisma.agentIntentPolicy.upsert({
      where: { id: pol.id },
      update: pol,
      create: pol
    });
  }

  const nhiCount = await prisma.machineIdentity.count();
  const polCount = await prisma.agentIntentPolicy.count();
  console.log(`✅ Successfully seeded ${nhiCount} MachineIdentity and ${polCount} AgentIntentPolicy records into PostgreSQL database!`);
}

seedNHI()
  .catch((e) => {
    console.error('❌ Error seeding NHI & Policies:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
