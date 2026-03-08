/**
 * Authentication helpers for E2E tests.
 * Logs in via the /login form using NextAuth credentials provider.
 */
import { type Page, expect } from "@playwright/test";

/** Signs out the current session via NextAuth signout endpoint. */
export async function logout(page: Page) {
  await page.goto("/api/auth/signout");
  const btn = page.getByRole("button", { name: /sign out/i });
  if (await btn.isVisible()) await btn.click();
  await page.waitForURL((url) => !url.pathname.includes("/signout"), { timeout: 10_000 });
}

/** Logs in a user via the /login page and waits for redirect. */
export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 15_000,
  });
}

/** Logs in as the E2E candidate using env-configured credentials. */
export async function loginAsCandidate(page: Page) {
  const email = process.env.E2E_CANDIDATE_EMAIL;
  const password = process.env.E2E_CANDIDATE_PASSWORD;
  if (!email || !password) throw new Error("E2E_CANDIDATE_EMAIL/PASSWORD not set");
  await login(page, email, password);
}

/** Logs in as the E2E company user using env-configured credentials. */
export async function loginAsCompany(page: Page) {
  const email = process.env.E2E_COMPANY_EMAIL;
  const password = process.env.E2E_COMPANY_PASSWORD;
  if (!email || !password) throw new Error("E2E_COMPANY_EMAIL/PASSWORD not set");
  await logout(page);
  await login(page, email, password);
}
