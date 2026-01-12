/**
 * Shared authorization helpers for company job APIs.
 */
import type { Session } from "next-auth";

/**
 * Ensures the session belongs to a company user.
 */
export function ensureCompanyRole(session: Session | null) {
    const role = session?.user?.role;
    if (role !== "COMPANY") {
        throw new Error("Company role required");
    }
}
