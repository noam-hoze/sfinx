/**
 * Unit tests for home redirect helpers.
 */
import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import { getRedirectPath, getRedirectPathForStatus } from "./homeRedirect";

const buildSession = (role?: string): Session => ({
  user: role ? ({ role } as any) : ({} as any),
  expires: "2030-01-01T00:00:00.000Z",
});

describe("homeRedirect helpers", () => {
  it("returns login when session is missing", () => {
    expect(getRedirectPath(null)).toBe("/login");
  });

  it("returns job search for candidate", () => {
    const session = buildSession("CANDIDATE");
    expect(getRedirectPath(session)).toBe("/job-search");
  });

  it("returns company dashboard for company", () => {
    const session = buildSession("COMPANY");
    expect(getRedirectPath(session)).toBe("/company-dashboard");
  });

  it("returns null for unknown role", () => {
    const session = buildSession("ADMIN");
    expect(getRedirectPath(session)).toBeNull();
  });

  it("does not redirect while loading", () => {
    const session = buildSession("CANDIDATE");
    expect(getRedirectPathForStatus("loading", session)).toBeNull();
  });

  it("redirects based on status and session", () => {
    const session = buildSession("CANDIDATE");
    expect(getRedirectPathForStatus("authenticated", session)).toBe("/job-search");
  });
});
