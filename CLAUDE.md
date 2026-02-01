# Claude AI Assistant Guidelines for Sfinx

## Project Overview

Sfinx is an AI-powered autonomous technical screening interview system. It conducts, scores, and ranks technical candidates automatically, delivering consistent and scalable screening interviews.

## Architecture

- **Framework**: Next.js (App Router) with TypeScript
- **Frontend**: React with TypeScript
- **Backend**: Node.js API routes, Server Actions, Python microservices
- **AI/ML**: OpenAI Realtime API, Chat Completions API
- **Database**: Neon/PostgreSQL with custom JSON vector index
- **Infrastructure**: Docker, GCP Cloud Run
- **Package Manager**: pnpm (see pnpm-lock.yaml)

## Key Directories

- `/app` - Next.js app router pages and layouts
- `/server` - Backend services and API logic
- `/shared` - Shared utilities and types
- `/lib` - Library code and integrations
- `/docs` - Project documentation
- `/public` - Static assets
- `/.github` - GitHub workflows and issue templates

## Development Guidelines

### Code Style
- Use TypeScript for all new code
- Follow existing ESLint configuration (.eslintrc.cjs)
- Use functional components and React hooks
- Prefer async/await over promise chains
- Keep functions small and focused

### Testing
- Run tests with `npm run test` or `npx vitest run`
- Tests are located alongside source files
- All tests must pass before merging
- CI runs Vitest on Node 18.x and 20.x

### Git Workflow
- Create feature branches from main/master
- Use descriptive commit messages
- Keep commits focused and atomic
- Reference issue numbers in commits when applicable

### Dependencies
- Install with: `pnpm install --frozen-lockfile`
- Update lockfile only when adding/updating dependencies
- Prefer established, well-maintained packages

## Key Features to Understand

1. **Real-time Interview System**
   - Uses OpenAI Realtime API for low-latency conversation
   - Streaming audio and transcription
   - Session state management

2. **Hybrid Retrieval System**
   - Embedding search (text-embedding-3-small)
   - BM25-style lexical scoring
   - Dynamic context injection

3. **Evaluation Engine**
   - Structured scoring pipeline
   - Standardized candidate assessments
   - Comparable ranking scores

4. **Persona System**
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
2. Follow existing code patterns
3. Update tests if needed
4. Ensure no security vulnerabilities (XSS, injection, etc.)
5. Avoid over-engineering

### Testing
1. Run the test suite: `npm run test`
2. Test locally with: `npm run dev`
3. Verify no breaking changes
4. Check for type errors

### Before Submitting PR
1. All tests must pass
2. Code follows project conventions
3. Commit messages are clear
4. No unnecessary dependencies added
5. Documentation updated if needed

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
- **Document** complex logic with comments
- **Ask** for clarification if requirements are unclear

## Resources

- Main documentation: `/docs`
- System design: `/docs/system-design.md`
- Agents info: `AGENTS.md`
- Change log: `CHANGELOG.md`

## Contact

- Project Owner: Noam Hoze
- LinkedIn: linkedin.com/in/noam-hoze
