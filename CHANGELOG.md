# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project adheres to Semantic Versioning.

## [0.3.0] - 2025-08-31

### Added
- Detailed UI Design Document (`Sfinx Demo UI Design Document.md`) outlining the "Apple-like" aesthetic and core principles.
- New "AI Interviewer Session" screen concept, featuring a Cursor-like multi-pane layout for a live, interactive coding interview.
- Implementation plan (`AI_INTERVIEWER_IMPLEMENTATION_PLAN.md`) with a detailed checklist for building the new interview screen.
- Tailwind CSS for styling, configured with the project's custom color palette and fonts.
- Foundational components for the "Candidate Session" view.

### Changed
- Refined the Sfinx concept to include "Learning Capability" as a core telemetry signal, tracking how candidates seek and apply information.

## [0.2.0] - 2025-08-10

### Added

-   Prisma schema with models: `JD`, `Task`, `Session`, `TpeProfile`, `Score`, `PanelLabel` (+ enum).
-   Seed script creating 2 JDs with 3 tasks each.
-   Debug endpoint `GET /api/debug/seed` to inspect seeded JDs and tasks.

### Notes

-   Database setup pending a running Postgres instance. Use Docker or Homebrew and set `DATABASE_URL`.

## [0.1.1] - 2025-08-10

### Added

-   Minimal App Router with `/health` route returning `{ ok: true }`.
-   Base TypeScript config and ESLint setup.

### Changed

-   Switched Next.js config from `next.config.ts` to supported `next.config.js` for Next 14.
-   Pinned dependency versions for compatibility (`escomplex`, `multer`).

### Fixed

-   Dev server boot failure due to unsupported `next.config.ts`.

## [0.1.0] - 2025-08-10

### Added

-   Initial project scaffolding.

[0.1.1]: https://github.com/noam-hoze/sfinx/compare/v0.1.0...v0.1.1
[0.2.0]: https://github.com/noam-hoze/sfinx/compare/v0.1.1...v0.2.0
[0.3.0]: https://github.com/noam-hoze/sfinx/compare/v0.2.0...v0.3.0
