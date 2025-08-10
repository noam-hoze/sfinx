# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project adheres to Semantic Versioning.

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
