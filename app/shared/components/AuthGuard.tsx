"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect } from "react";

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
    const searchParams = useSearchParams();
    const pathname = usePathname();

    const isDemoMode = searchParams.get("demo") === "true";

    useEffect(() => {
        if (isDemoMode) return;

        if (status === "loading") return; // Still loading

        const search = searchParams.toString();
        const callbackUrl = `${pathname ?? ""}${search ? `?${search}` : ""}`;

        if (!session) {
            // User is not authenticated
            const loginUrl = callbackUrl.length
                ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
                : "/login";
            router.push(loginUrl);
            return;
        }

        const userRole = (session.user as any)?.role;

        // Admin can access all pages
        if (userRole === "ADMIN") {
            return;
        }

        // Check if user has the exact required role
        if (userRole !== requiredRole) {
            const loginUrl = callbackUrl.length
                ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
                : "/login";
            router.push(loginUrl);
            return;
        }
    }, [session, status, requiredRole, router, isDemoMode, pathname, searchParams]);

    if (isDemoMode) {
        return <>{children}</>;
    }

    // Show loading state while checking authentication
    if (status === "loading") {
        return (
            fallback || (
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
