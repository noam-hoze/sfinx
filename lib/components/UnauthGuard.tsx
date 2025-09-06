"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface UnauthGuardProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export default function UnauthGuard({ children, fallback }: UnauthGuardProps) {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === "loading") return; // Still loading

        if (session) {
            // User is authenticated, redirect away from unauth pages
            const userRole = (session.user as any)?.role;
            if (userRole === "CANDIDATE") {
                router.push("/job-search");
            } else if (userRole === "COMPANY") {
                router.push("/company-dashboard");
            } else {
                router.push("/"); // Fallback for other roles or no role
            }
        }
    }, [session, status, router]);

    // Show loading state while checking authentication
    if (status === "loading" || session) {
        return (
            fallback || (
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            )
        );
    }

    // If not authenticated, show the children (login/signup page)
    return <>{children}</>;
}
