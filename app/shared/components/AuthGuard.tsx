"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface AuthGuardProps {
    children: React.ReactNode;
    requiredRole?: "CANDIDATE" | "COMPANY" | "ADMIN" | "ANY";
    fallback?: React.ReactNode;
}

export default function AuthGuard({
    children,
    requiredRole = "CANDIDATE",
    fallback,
}: AuthGuardProps) {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === "loading") return; // Still loading

        if (!session) {
            // User is not authenticated
            router.push("/login");
            return;
        }

        const userRole = (session.user as any)?.role;

        // Admin can access all pages
        if (userRole === "ADMIN") {
            return;
        }

        // ANY allows any authenticated user regardless of role
        if (requiredRole === "ANY") {
            return;
        }

        // Check if user has the exact required role
        if (userRole !== requiredRole) {
            router.push("/login");
            return;
        }
    }, [session, status, requiredRole, router]);

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

    // ANY allows any authenticated user regardless of role
    if (requiredRole === "ANY") {
        return <>{children}</>;
    }

    // Check if user has the exact required role
    if (userRole !== requiredRole) {
        return null;
    }

    return <>{children}</>;
}
