"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === "loading") return; // Still loading

        if (!session) {
            router.push("/login");
            return;
        }

        // Redirect based on user role
        const userRole = (session.user as any)?.role;
        if (userRole === "CANDIDATE") {
            router.push("/job-search");
        } else if (userRole === "COMPANY") {
            router.push("/company-dashboard");
        }
    }, [session, status, router]);

    // Show loading state while redirecting
    return (
        <main className="min-h-screen flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                <p className="mt-2 text-gray-600">Redirecting...</p>
            </div>
        </main>
    );
}
