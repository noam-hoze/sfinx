"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SfinxSpinner } from "app/shared/components";

export default function Home() {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === "loading") return; // Still loading

        if (session) {
            // Redirect based on user role
            const userRole = (session.user as any)?.role;
            if (userRole === "CANDIDATE") {
                router.push("/job-search");
            } else if (userRole === "COMPANY") {
                router.push("/company-dashboard");
            }
        } else {
            // No session - redirect to login
            router.push("/login");
        }
    }, [session, status, router]);

    // Show loading state while checking session
    if (status === "loading") {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <SfinxSpinner size="lg" title="Loading" messages="Checking your session..." />
            </main>
        );
    }

    // Show redirecting state while redirect happens
    return (
        <main className="min-h-screen flex items-center justify-center">
            <SfinxSpinner size="lg" title="Redirecting" messages="Taking you to your dashboard..." />
        </main>
    );
}
