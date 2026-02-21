/**
 * Prefetch interview scripts for visible jobs on the job-search page.
 * Populates localStorage cache so scripts are instant on the interview page.
 */

import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;
const SCRIPT_CACHE_VERSION = "v8"; // Must match useBackgroundPreload.ts

/**
 * Prefetch interview scripts for all given jobs in the background.
 * Uses the same localStorage cache key format as useBackgroundPreload.
 * Fire-and-forget — failures are silently ignored.
 */
export function prefetchInterviewScripts(jobs: { id: string }[]) {
  let prefetchCount = 0;

  for (const job of jobs) {
    const cacheKey = `interview-script-${job.id}-${SCRIPT_CACHE_VERSION}`;

    // Skip if already cached
    try {
      if (localStorage.getItem(cacheKey)) continue;
    } catch {
      continue;
    }

    const parts = job.id.split("-");
    const company = parts[0];
    const role = parts.slice(1).join("-");

    if (!company || !role) continue;

    prefetchCount++;

    // Fire-and-forget, non-blocking
    fetch(`/api/interviews/script?company=${company}&role=${role}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(data));
          } catch {
            // localStorage full — ignore
          }
        }
      })
      .catch(() => {}); // Silent failure
  }

  if (prefetchCount > 0) {
    log.info(LOG_CATEGORY, `[prefetch] Prefetching ${prefetchCount} interview script(s)`);
  }
}
