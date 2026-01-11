/** Logger configuration for levels, categories, and label overrides. */
export const LOG_LEVEL = "info" as const; // 'debug' | 'info' | 'warn' | 'error' | 'silent'

/** Log categories enum for type-safe category usage. */
export const LOG_CATEGORIES = {
  AUTH: "auth",
  AUTH_API: "auth-api",
  APPLICATIONS: "applications",
  BACKGROUND_INTERVIEW: "background-interview",
  CACHE: "cache",
  COMPANIES: "companies",
  COMPANY: "company",
  COMPANY_DASHBOARD: "company-dashboard",
  CPS: "cps",
  DB: "db",
  INTERVIEWS: "interviews",
  INTERVIEW_UI: "interview-ui",
  JOB_APPLICATION: "job-application",
  JOB_SEARCH: "job-search",
  SETTINGS: "settings",
  TELEMETRY: "telemetry",
  UPLOAD: "upload",
  USERS: "users",
} as const;

export type LogCategory = typeof LOG_CATEGORIES[keyof typeof LOG_CATEGORIES];

/** Category filter mode for log emission. */
export type CategoryFilterMode = "allowlist" | "blocklist";

/** Category filter mode that determines how CATEGORY_FILTER is interpreted. */
export const CATEGORY_FILTER_MODE: CategoryFilterMode = "blocklist";

/** Category filter values for the current filter mode. */
export const CATEGORY_FILTER: LogCategory[] = [
  LOG_CATEGORIES.AUTH,
  LOG_CATEGORIES.AUTH_API,
  LOG_CATEGORIES.APPLICATIONS,
  LOG_CATEGORIES.BACKGROUND_INTERVIEW,
  LOG_CATEGORIES.CACHE,
  LOG_CATEGORIES.COMPANIES,
  LOG_CATEGORIES.COMPANY,
  LOG_CATEGORIES.COMPANY_DASHBOARD,
  LOG_CATEGORIES.CPS,
  LOG_CATEGORIES.DB,
  LOG_CATEGORIES.INTERVIEWS,
  LOG_CATEGORIES.INTERVIEW_UI,
  LOG_CATEGORIES.JOB_APPLICATION,
  LOG_CATEGORIES.JOB_SEARCH,
  LOG_CATEGORIES.SETTINGS,
  LOG_CATEGORIES.TELEMETRY,
  LOG_CATEGORIES.UPLOAD,
  LOG_CATEGORIES.USERS,
];

// Empty means: allow all files to log
export const ALLOWLIST: (string | RegExp)[] = [];

// Optional label overrides: match by substring or RegExp → label
// Example: { match: "/app/(features)/job-search/page.tsx", label: "job-search/page" }
export const LABEL_OVERRIDES: Array<{ match: string | RegExp; label: string }> = [];
