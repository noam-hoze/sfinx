"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === "loading") return; // Still loading

        // Only redirect if there IS a session
        if (session) {
            // Redirect based on user role
            const userRole = (session.user as any)?.role;
            if (userRole === "CANDIDATE") {
                router.push("/job-search");
            } else if (userRole === "COMPANY") {
                router.push("/company-dashboard");
            }
        }
        // If there's no session, do nothing and let the page render.
        // The user might be trying to access /login or /signup.
    }, [session, status, router]);

    // Show loading state while checking session
    if (status === "loading" || session) {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Redirecting...</p>
                </div>
            </main>
        );
    }

    // If no session, render nothing, allowing nested routes like /login to render.
    return null;
}
