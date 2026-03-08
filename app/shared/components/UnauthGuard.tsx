"use client";

import type { Route } from "next";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import SfinxSpinner from "./SfinxSpinner";
import { isInterviewRedirect, sanitizeNextPath } from "app/shared/utils/redirects";

interface UnauthGuardProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export default function UnauthGuard({ children, fallback }: UnauthGuardProps) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (status === "loading") return; // Still loading

        if (session) {
            // User is authenticated, redirect away from unauth pages
            const userRole = (session.user as any)?.role;
            const nextPath = sanitizeNextPath(searchParams.get("next"), "/job-search");
            if (userRole === "CANDIDATE" && isInterviewRedirect(nextPath)) {
                router.push(nextPath as Route);
            } else if (userRole === "CANDIDATE") {
                router.push("/job-search");
            } else if (userRole === "COMPANY") {
                router.push("/company-dashboard");
            } else {
                router.push("/"); // Fallback for other roles or no role
            }
        }
    }, [session, status, router, searchParams]);

    // Show loading state while checking authentication
    if (status === "loading" || session) {
        return (
            fallback || (
                <div className="min-h-screen flex items-center justify-center">
                    <SfinxSpinner size="lg" title="Loading" messages="Preparing your experience..." />
                </div>
            )
        );
    }

    // If not authenticated, show the children (login/signup page)
    return <>{children}</>;
}
