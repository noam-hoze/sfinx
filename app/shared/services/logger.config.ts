/** Logger configuration for levels, categories, and label overrides. */
export const LOG_LEVEL = "info" as const; // 'debug' | 'info' | 'warn' | 'error' | 'silent'

/** Category filter mode for log emission. */
export type CategoryFilterMode = "allowlist" | "blocklist";

/** Category filter mode that determines how CATEGORY_FILTER is interpreted. */
export const CATEGORY_FILTER_MODE: CategoryFilterMode = "blocklist";

/** Category filter values for the current filter mode. */
export const CATEGORY_FILTER: string[] = [];

// Empty means: allow all files to log
export const ALLOWLIST: (string | RegExp)[] = [];

// Optional label overrides: match by substring or RegExp → label
// Example: { match: "/app/(features)/job-search/page.tsx", label: "job-search/page" }
export const LABEL_OVERRIDES: Array<{ match: string | RegExp; label: string }> = [];
