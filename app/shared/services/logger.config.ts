export const LOG_LEVEL = "info" as const; // 'debug' | 'info' | 'warn' | 'error' | 'silent'

// Empty means: allow all files to log
export const ALLOWLIST: (string | RegExp)[] = [];
