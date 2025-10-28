export const LOG_LEVEL = "info" as const; // 'debug' | 'info' | 'warn' | 'error' | 'silent'

// Empty means: allow all files to log
export const ALLOWLIST: (string | RegExp)[] = [];

// Optional label overrides: match by substring or RegExp → label
// Example: { match: "/app/(features)/job-search/page.tsx", label: "job-search/page" }
export const LABEL_OVERRIDES: Array<{ match: string | RegExp; label: string }> = [];
