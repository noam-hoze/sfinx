# Claude AI Assistant Guidelines for Sfinx

## Project Overview

Sfinx is an AI-powered autonomous technical screening interview system. It conducts, scores, and ranks technical candidates automatically, delivering consistent and scalable screening interviews.

## Architecture

- **Framework**: Next.js (App Router) with TypeScript — single application, no Docker locally, no separate backend
- **Frontend**: React with TypeScript
- **Backend**: Node.js API routes, Server Actions (all served by `pnpm dev` on port 3000)
- **AI/ML**: OpenAI Realtime API, Chat Completions API
- **Database**: Neon/PostgreSQL with custom JSON vector index
- **Package Manager**: pnpm (see pnpm-lock.yaml)

## Key Directories

- `/app` - Next.js app router pages and layouts
- `/server` - Backend services and API logic
- `/shared` - Shared utilities and types
- `/lib` - Library code and integrations
- `/docs` - Project documentation
- `/public` - Static assets
- `/.github` - GitHub workflows and issue templates

## Local Development

### Running the app
- `pnpm dev` — starts the Next.js dev server (port 3000). Requires `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `OPENAI_API_KEY`, `NEXT_PUBLIC_OPENAI_EVALUATION_MODEL` as environment variables.
- The app redirects unauthenticated users to `/login`. Create a test candidate account via `/signup`.

### Key commands
- Lint: `pnpm lint`
- Tests: `pnpm test` (vitest)
- Prisma client: `npx prisma generate` (uses `server/prisma/schema.prisma`)
- DB push: `pnpm db:push:dev` (reads `DATABASE_URL` from `.env.local`)

### Gotchas
- Node.js 20 is required (`.nvmrc`). Use `nvm use 20` if the environment defaults to another version.
- After `pnpm install`, run `npx prisma generate` before the app can start.
- `pnpm-workspace.yaml` uses `ignoredBuiltDependencies` for Prisma packages; build-script warnings are expected and safe to ignore.
- The local `.tgz` dependency `mascotbot-sdk-react-0.1.9.tgz` is bundled in the repo root.

## Constitution Principles

### I. Hard Ban on Fallbacks
- Hidden fallbacks or implicit behavior are PROHIBITED unless a maintainer spells out the exact fallback in writing for that change.
- Any approved fallback MUST ship behind a documented feature flag or configuration toggle with monitoring.
- Every violation must block merges and be logged in the changelog with remediation steps.
- Default-value fallbacks are forbidden: expressions like `const companyName = ms.companyName || "Company"` MUST NOT be used.

### II. Reuse-First and Modularity
- Teams MUST prioritize reusing existing code and composing modular units over duplicating logic.
- Modules MUST have a single clear purpose and minimal coupling; prefer helpers/services/components over large files.
- When identical logic repeats, extract it into a shared helper immediately.

### III. Function Length Discipline (≤25 lines)
- Functions MUST remain under 25 lines of code (excluding comments and blank lines).
- Applies to all `.ts`, `.tsx` under `app/`, `shared/`, `server/`; generated code excluded.
- When a function exceeds this limit, extract helper functions with clear, descriptive names.

### IV. Documentation Discipline
- Every file and public function MUST be documented succinctly where defined (TypeScript doc comments).
- Function documentation MUST be concise (≤4 lines) while explaining purpose and key behavior.
- Documentation MUST be included in the same change as any new file or function.

### V. Library-First Integration
- Prefer integrating mature, well-maintained libraries before building custom implementations.
- Evaluate maintenance signals (recent releases, issue activity) and license compatibility before adoption.

### VI. Evidence-First Debugging & Causality
- Before implementing fixes, establish a clear, code-level causal chain for any defect.
- Proof requires: reproducible steps, precise log/trace evidence, and file/line references.
- No guesswork or speculative mitigations; fixes proceed only after causality is demonstrated.

### VII. Observability & Logging
- ALL logging MUST use the logger service at `app/shared/services/logger.ts`; direct `console.log`, `console.error`, or other console methods are PROHIBITED.
- Logs MUST include correlation context (request/session IDs) and minimal input/output summaries; secrets and PII MUST be redacted.
- Log levels MUST be consistent (debug/info/warn/error); logs MUST be actionable and avoid noise or duplication.
- Failures MUST be logged explicitly — do NOT add hidden fallbacks that mask failures.

## Development Guidelines

### Code Style
- Use TypeScript for all new code
- Follow existing ESLint configuration (.eslintrc.cjs)
- Use functional components and React hooks
- Prefer async/await over promise chains
- Keep functions small and focused (≤25 lines per constitution)

### Git Workflow
- Create feature branches from main/master
- Use descriptive commit messages
- Keep commits focused and atomic
- Reference issue numbers in commits when applicable
- **Never commit or push without explicit user approval.** Always show a summary of changes and wait for the user to say "commit" or "push" before running those commands.

### Dependencies
- Install with: `pnpm install --frozen-lockfile`
- Update lockfile only when adding/updating dependencies
- Prefer established, well-maintained packages

## Quality Gates

- **Static analysis**: Repository MUST pass `tsc --noEmit` and ESLint before merging.
- **Specifications**: Each feature under `app/(features)/<feature>/` MUST have a local spec at `docs/specs/<feature>.md` referenced in commits.
- **Library Scan Gate (MANDATORY)**: Before implementing any non-trivial utility or infrastructure, document a brief "Library Scan" in `research.md`: candidates, decision, rationale, alternatives. Prefer a library unless a documented constraint justifies custom code.
- **File-length gate**: CI fails if file-length limits are exceeded (generated files excluded).
- **POC mode**: Direct commits allowed; decisions recorded in specs/commits.

## Key Features to Understand

1. **Real-time Interview System**
   - Uses OpenAI Realtime API for low-latency conversation
   - Streaming audio and transcription
   - Session state management

2. **Evaluation Engine**
   - Structured scoring pipeline
   - Standardized candidate assessments
   - Comparable ranking scores

3. **Persona System**
   - Role-specific interviewer behaviors
   - Few-shot learning examples
   - Context-aware questioning

## When Working on Issues

### Before Starting
1. Read the issue description carefully
2. Check related documentation in `/docs`
3. Review existing code patterns
4. Identify affected components

### Implementation
1. Make minimal, focused changes
2. Follow existing code patterns and constitution principles
3. Ensure no security vulnerabilities (XSS, injection, etc.)
4. Avoid over-engineering

### Before Submitting PR
1. Code follows project conventions
2. Commit messages are clear
3. No unnecessary dependencies added
4. Documentation updated if needed

## Common Patterns

### API Routes
- Located in `/app/api`
- Use Next.js route handlers
- Handle errors consistently
- Validate inputs

### Server Actions
- Used for secure server-side operations
- Prefix with "use server"
- Handle authentication/authorization
- Return serializable data

### Components
- Keep components focused and reusable
- Use TypeScript interfaces for props
- Handle loading and error states
- Optimize for performance

## Important Notes

- **Never** commit sensitive data (API keys, credentials)
- **Always** test changes locally first
- **Preserve** existing functionality unless explicitly changing it
- **Ask** for clarification if requirements are unclear
- Conversation and session data defaults to in-memory for POC; persistence requires explicit approval
- Accessibility and performance are non-negotiable: fast first interaction and readable UI components

## Communication Style

- All responses MUST be limited to 5 sentences maximum.
- Concise, direct communication is mandatory.

## AI Efficiency & Token Optimization

- Use `Grep` or `codebase_search` instead of reading entire files when searching for specific patterns.
- Execute all independent tool calls in parallel (batch file reads, searches, etc.).
- NEVER re-read files unnecessarily; remember file contents from earlier in the conversation.
- Use targeted line ranges (`offset`/`limit`) when reading large files; only read full files when absolutely necessary.
- Execute changes immediately without verbose explanations; let the code speak for itself.
- Only read/reference files directly relevant to the current task.
- Prefer targeted edits over full file rewrites to minimize token usage.

## Resources

- Main documentation: `/docs/` (see MEMORY.md for full index)
- System design: `/docs/architecture/system-design.md`
- Change log: `CHANGELOG.md`

## Contact

- Project Owner: Noam Hoze
- LinkedIn: linkedin.com/in/noam-hoze
