/**
 * Mock data for Sfinx NHI & Agentic Access Management (AAM) Dashboard.
 */

export interface CandidateInfo {
  id: string;
  name: string;
  role: string;
  avatar: string;
  completedAt: string;
  transcriptSnippet: string;
}

export interface MachineIdentity {
  id: string;
  name: string;
  type: string;
  provider: 'AWS' | 'GitHub' | 'OpenAI' | 'PostgreSQL' | 'Internal';
  keyAgeDays: number;
  owner: string;
  permissions: string[];
  isOverPrivileged: boolean;
  riskSeverity: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'ACTIVE' | 'ROTATING' | 'ROTATED';
  lastUsed: string;
}

export const MOCK_CANDIDATE: CandidateInfo = {
  id: "cand-88392",
  name: "Alex Rivera",
  role: "Senior Full-Stack Engineer",
  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  completedAt: "2026-08-19 06:45 AM",
  transcriptSnippet: "Built distributed event pipelines using Node.js, Kafka, and Redis. Implemented microservice authentication using JWT and OAuth2."
};

export const INITIAL_IDENTITIES: MachineIdentity[] = [
  {
    id: "nhi-01",
    name: "openai-evaluator-api-key (sk-...BToA)",
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
