"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

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
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading...</p>
                </div>
            </main>
        );
    }

    // Show redirecting state while redirect happens
    return (
        <main className="min-h-screen flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                <p className="mt-2 text-gray-600">Redirecting...</p>
            </div>
        </main>
    );
}
