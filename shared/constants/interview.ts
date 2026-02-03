/**
 * Shared constants for interview evaluation
 */

/**
 * Number of contributions required per category before switching to next category
 * Configurable via NEXT_PUBLIC_CONTRIBUTIONS_TARGET environment variable
 */
export const CONTRIBUTIONS_TARGET = parseInt(
  process.env.NEXT_PUBLIC_CONTRIBUTIONS_TARGET || '5',
  10
);
