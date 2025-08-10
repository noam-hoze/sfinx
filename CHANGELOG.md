# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project adheres to Semantic Versioning.

## [0.1.1] - 2025-08-10
### Added
- Minimal App Router with `/health` route returning `{ ok: true }`.
- Base TypeScript config and ESLint setup.

### Changed
- Switched Next.js config from `next.config.ts` to supported `next.config.js` for Next 14.
- Pinned dependency versions for compatibility (`escomplex`, `multer`).

### Fixed
- Dev server boot failure due to unsupported `next.config.ts`.

## [0.1.0] - 2025-08-10
### Added
- Initial project scaffolding.

[0.1.1]: https://github.com/noam-hoze/sfinx/compare/v0.1.0...v0.1.1
