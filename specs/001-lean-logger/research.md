# Research: Lean Logger

## Decision

Adopt `loglevel` for unified logging with a single global level; add an optional central allowlist wrapper using `methodFactory` to drop logs from non-allowed files.

## Rationale

- Tiny, dependency-free, works in browser and Node.  
- Built-in levels cover `debug`, `info`, `warn`, `error`; `setLevel` is global and explicit.  
- Wrapper enables one place to control which files/components emit logs without touching components.

## Alternatives Considered

- `debug`: tag-centric; still needs per-callsite tags; not desired.  
- `consola`: nice DX; larger surface and SSR nuances.  
- `tslog`: richer features; heavier than needed for this use case.

## Open Items

None. Allowlist defaults to disabled (all allowed); can be toggled by editing a single config export.

