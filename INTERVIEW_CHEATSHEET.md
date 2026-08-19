# 🛡️ Sfinx Solution Architect Interview Cheat Sheet
**Oasis Security Demo — Talking Points & Architectural Guide**

---

## 🎯 1. Core Problem Statement (The "Why")

* **The Non-Human Identity (NHI) Problem:** Machine-to-machine credentials (API keys, service accounts, IAM roles, deploy keys) outnumber human identities 45:1 in modern cloud environments.
* **The Vulnerability:** Credentials are left static for months (e.g. **142 days old**), assigned to generic or **unassigned owners**, with dangerous **wildcard `*` permissions**.
* **The Risk:** A compromised AI agent or leaked environment file gives attackers unrestricted permanent access across the entire organization.

---

## 🚀 2. Scenario 1: NHI Governance & Zero-Touch Rotation

* **Initial State:** `openai-evaluator-api-key` is **142 days old**, **Unassigned**, and flagged as **HIGH RISK**.
* **Remediation Action:** Programmatic secret rotation via **OpenAI Administration REST API**.
* **Key Talking Points:**
  * **Zero-Touch Automation:** No developer intervention required to cycle production secrets.
  * **Live TTL Countdown Clock:** Real-time **60s Time-To-Live (TTL)** backward timer.
  * **Real OpenAI Platform Purging:** At `00:00`, Sfinx calls OpenAI's Admin REST API to **delete the Service Account key from OpenAI's servers**, ensuring zero stale keys remain active.
  * **Posture Score Improvement:** Posture risk score instantly updates to **HEALTHY (Green)** once remediated.

---

## 🔐 3. Scenario 2: Agentic Access Management (AAM) & JIT Tokens

* **Concept — Just-In-Time (JIT) Scoping:** Instead of giving AI agents static credentials, grant temporary JIT tokens only when an action is requested.
* **Concept — Blast Radius Shrinkage:**
  * **Before:** Agent possessed full wildcard `*` permissions (`models:all`, `fine-tuning:*`).
  * **After:** Sfinx Policy Engine dynamically shrinks permissions down to exact least-privilege intent scopes: `[candidates:read, evaluations:write]`.
* **Browser & Client Security (Key Defense Question):**
  * **Zero Client Exposure:** Secret keys and Admin API tokens are **NEVER exposed to the browser runtime**.
  * All credential generation, OpenAI API calls, and PostgreSQL updates execute strictly on the **server-side Sfinx Control Plane**.
  * The browser UI only receives ephemeral token metadata and audit trail logs.

---

## 🛑 4. Scenario 3: Rogue Agent Interception & Policy Engine

* **The Threat Scenario:** A compromised or misaligned AI Screener Bot attempts to exfiltrate administrative system secrets by calling `GET /api/admin/system-secrets`.
* **Policy Engine Interception:**
  * Sfinx intercepts the request before it reaches sensitive resources.
  * Evaluates against PostgreSQL `AgentIntentPolicy` rules (`pol-01`).
  * Detects that `/api/admin/system-secrets` is listed under `restrictedPaths` for `screener-bot`.
* **Enforcement & Containment:**
  * Returns a **real HTTP 403 Forbidden** error (`Access Denied: Sfinx Policy Engine Intercepted Unauthorized Rogue Call`).
  * Prevents secret leakage and logs a **Security Threat Alert** directly to the PostgreSQL audit trail stream.

---

## 📚 5. Instant Terminology & Acronym Reference

| Term / Acronym | Definition & Demo Context |
| :--- | :--- |
| **NHI (Non-Human Identity)** | Machine credentials used by automated services, scripts, and AI agents. |
| **AAM (Agentic Access Management)** | Governance layer enforcing policy boundaries on autonomous AI agent intentions. |
| **JIT (Just-In-Time) Credentials** | Ephemeral, short-lived tokens generated on-demand and auto-destroyed after use. |
| **TTL (Time-To-Live)** | Expiration lifespan (e.g. 60s countdown clock) after which a key is auto-deleted. |
| **Least Privilege** | Restricting agent permissions strictly to the exact scopes needed for the immediate task. |
| **Blast Radius Containment** | Preventing a compromised key from accessing sensitive endpoints or resources. |
| **Zero-Touch Remediation** | Automated credential rotation and purging without manual human key copying. |

---

## 💡 6. Quick Demo Flow Checklist (3-Minute Presentation)

1. **Start on Security Page (`/admin/nhi-dashboard`):** Highlight the **142-day-old unassigned OpenAI key** and explain why static NHIs are the #1 attack vector.
2. **Switch to Sandbox (`/admin/simulation`):**
   * **Run Test 1 (Valid Agent Flow):** Show JIT token issuance, scope shrinkage to `[candidates:read, evaluations:write]`, and the **live 60s ticking clock**. Highlight that at `00:00`, the key is **purged from OpenAI platform**.
   * **Run Test 2 (Rogue Agent Attack):** Show the agent trying to hit `/api/admin/system-secrets`, getting blocked with a **real HTTP 403 Forbidden**, and logging a threat alert to PostgreSQL.
3. **Show OpenAI Platform Tab (`platform.openai.com/api-keys`):** Demonstrate real synchronization — 1 active key during rotation, 0 keys after 60s expiry.
