"use client";

import type { Route } from "next";
import { signOut, useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import SfinxSpinner from "./SfinxSpinner";
import { appendNextParam } from "app/shared/utils/redirects";

interface AuthGuardProps {
    children: React.ReactNode;
    requiredRole?: "CANDIDATE" | "COMPANY" | "ADMIN";
    fallback?: React.ReactNode;
}

export default function AuthGuard({
    children,
    requiredRole = "CANDIDATE",
    fallback,
}: AuthGuardProps) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (status === "loading") return; // Still loading

        const currentPath = `${pathname}${
            searchParams?.toString() ? `?${searchParams.toString()}` : ""
        }`;
        const loginPath = appendNextParam("/login", currentPath);

        if (!session) {
            // User is not authenticated
            router.push(loginPath as Route);
            return;
        }

        const userRole = (session.user as any)?.role;

        // Admin can access all pages
        if (userRole === "ADMIN") {
            return;
        }

        // Check if user has the exact required role
        if (userRole !== requiredRole) {
            void signOut({ callbackUrl: loginPath });
            return;
        }
    }, [session, status, requiredRole, router, pathname, searchParams]);

    // Show loading state while checking authentication
    if (status === "loading") {
        return (
            fallback || (
                <div className="min-h-screen flex items-center justify-center">
                    <SfinxSpinner size="lg" title="Authenticating" messages="Verifying your access..." />
                </div>
            )
        );
    }

    // If not authenticated, don't render children
    if (!session) {
        return null;
    }

    const userRole = (session.user as any)?.role;

    // Admin can access all pages
    if (userRole === "ADMIN") {
        return <>{children}</>;
    }

    // Check if user has the exact required role
    if (userRole !== requiredRole) {
        return null;
    }

    return <>{children}</>;
}
