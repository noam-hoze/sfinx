/**
 * Helpers for determining home page redirect targets.
 */
import type { Session } from "next-auth";

/**
 * Returns the redirect path based on the current session.
 */
export function getRedirectPath(session: Session | null): string | null {
  if (!session) {
    return "/login";
  }
  const userRole = (session.user as any)?.role;
  if (userRole === "CANDIDATE") {
    return "/job-search";
  }
  if (userRole === "COMPANY") {
    return "/company-dashboard";
  }
  return null;
}

/**
 * Returns a redirect path when status allows navigation.
 */
export function getRedirectPathForStatus(
  status: string,
  session: Session | null
): string | null {
  if (status === "loading") {
    return null;
  }
  return getRedirectPath(session);
}
