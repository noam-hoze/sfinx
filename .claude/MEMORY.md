# Sfinx Project Memory

## What is Sfinx
Sfinx is an AI-powered autonomous technical screening interview system. It conducts, scores, and ranks candidates fully automatically — no human interviewer needed. Candidates join a live interview session where an AI interviewer asks experience-based questions and gives them a coding task, then the system evaluates and scores everything to produce a ranked candidate list for the hiring company.

---

## Project Stack
- Next.js 15, App Router, TypeScript, pnpm
- Design: glassmorphism, --page-bg: #F7F5FF, --sfinx-purple: #8B5CF6
- Three.js installed, @react-three/fiber installed (unused — incompatible with Next.js 15 App Router)
- Single Next.js app — `pnpm dev` on port 3000; Node.js 20 required

---

## Docs Index

All documentation lives in /docs/. Read CLAUDE.md first for project guidelines.

### /docs/architecture/ — System-wide design and core algorithms
- `system-design.md` (42K) — Master architecture reference v1.1.0. Start here for any system-level question.
- `dynamic-category-prioritization-system.md` (35K) — Interview question selection; how categories are scored and sequenced.
- `unified-realtime-evaluation-system.md` (24K) — Debug panel architecture; real-time evaluation session state.

### /docs/evaluation/ — Scoring pipeline and answer judgment subsystems
- `scoring-system.md` (11K) — Experience + Coding score formulas, weights, and final score calculation.
- `job-specific-coding-categories.md` (26K) — Real-time code evaluation pipeline; company-defined coding criteria.
- `blank-answer-handling.md` (25K) — Empty answer preservation in OpenAI context; scoring implications.
- `answer-evaluation-optimization.md` (15K) — Dual-call latency optimization (~4s); relevance scoring.
- `external-tool-evaluation.md` (13K) — Paste detection + AI Assist Accountability Q&A flow.
- `dont-know-detection-and-topic-exclusion.md` (8K) — IDK detection logic and topic exclusion threshold.
- `contributions-target-and-transition-logic.md` (7.7K) — CONTRIBUTIONS_TARGET=3; phase transition logic.
- `evidence-clip-timing.md` (3.7K) — videoOffset timestamp formula for evidence clips.

### /docs/features/ — Shipped user-facing features
- `company-dashboard-score-implementation.md` (10K) — Dashboard score display; color coding (green≥75, orange≥50, red<50).
- `sfinx-animation-states.md` (10K) — UI animation states for the interview flow (announcement → talking).
- `interview-start-loading-optimization.md` (5.7K) — Warmup preload; reduces perceived load time to ~2s.
- `skip-to-coding-feature.md` (6.3K) — Dev flag ?skipToCoding=true; bypasses background interview phase.

### /docs/reference/ — Operational records (demos, migrations, handoffs)
- `async-interview-processing-handoff.md` (7.8K) — Feb 2026 bug fixes; agent handoff notes.
- `dynamic-categories-migration.md` (16K) — Static→dynamic category migration record.
- `qm-demo-jan-13-2026.md` (7.3K) — QM demo test case; 3 personas, Senior Python Engineer job spec.

### /docs/specs/ — Planned/future integrations
- `company-dashboard.md` — Job category generation spec.
- `mascot-integration.md` — Mascotbot lip-sync architecture (Rive character).
- `heygen_streaming_avatar_integration_2031ff0d.plan.md` — HeyGen streaming avatar integration plan.

### Root-level docs
- `README.md` — Project overview
- `CLAUDE.md` — Claude AI guidelines (authoritative; read first)
- `CHANGELOG.md` — Full version history
- `research.md` — Library scan and dependency decisions

---

## AtomScene (app/shared/components/AtomScene.tsx)

Raw Three.js atom spinner — R3F is incompatible with Next.js 15 App Router (react-reconciler conflict).

### Working state
- 3 orbital rings: rx=65°, ry=0/135/225°, grey (0x94a3b8), opacity 0.25, transparent
- Camera: (-0.036f, 3.608f, 2.689f) where f = cameraZ/4.5
- Electrons: colors 0xc084fc / 0x4f46e5 / 0x22d3ee, speeds 5.0 / 3.8 / 4.4
- Trails: THREE.Line + custom ShaderMaterial, TRAIL_LEN=35, per-vertex alpha pow(1 - j/TRAIL_LEN, 0.6)
  - depthTest:false + renderOrder=2 required (ring geometry occludes trails otherwise)
- Nucleus: pulsing purple sphere, MeshLambertMaterial, emissiveIntensity 0.6
- Electrons: MeshStandardMaterial, emissiveIntensity 0.7
- Point lights: layer 0 (not layer 1)
- toneMapping: THREE.NoToneMapping (ACES clips saturated emissives on light backgrounds)
- No EffectComposer/bloom — transparent canvas + light page = white washout
- Center sprite: /sfinx-avatar-nobg.png, scale (ph*0.75, ph, 1), position.y=-0.38
- Debug prop: enables OrbitControls + camera position overlay
- Test page: /test/spinner

### Key lessons
- THREE.Line is always 1px in WebGL (linewidth ignored)
- Bloom does not work on transparent canvas: EffectComposer RTs have alpha=1 everywhere → black square or white washout
