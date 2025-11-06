/**
 * @file Basic happy-path smoke test that validates the login entry point renders.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import type { ComponentProps } from "react";
import LoginPage from "../../app/(auth)/login/page";

vi.mock("next-auth/react", () => ({
    useSession: () => ({ data: null, status: "unauthenticated" }),
    signIn: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
    usePathname: () => "/login",
}));

vi.mock("next/link", () => ({
    __esModule: true,
    default: ({ children, ...props }: ComponentProps<"a">) => (
        <a {...props}>{children}</a>
    ),
}));

vi.mock("next/image", () => ({
    __esModule: true,
    default: ({ alt, src, priority, ...props }: ComponentProps<"img"> & { priority?: boolean }) => (
        <img alt={alt} src={src} {...props} data-priority={priority ? "true" : undefined} />
    ),
}));

test("renders the login funnel", () => {
    const markup = renderToStaticMarkup(<LoginPage />);
    expect(markup).toContain("Sign In");
    expect(markup).toContain("Continue with Google");
});
