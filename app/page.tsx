"use client";

/**
 * Home page redirect handler and loading UI.
 */
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SfinxSpinner } from "app/shared/components";
import { getRedirectPathForStatus } from "app/shared/utils/homeRedirect";

/**
 * Renders the status-specific view for the home page.
 */
function renderStatusView(status: string) {
    if (status === "loading") {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <SfinxSpinner size="lg" title="Loading" messages="Checking your session..." />
            </main>
        );
    }

    return (
        <main className="min-h-screen flex items-center justify-center">
            <SfinxSpinner size="lg" title="Redirecting" messages="Taking you to your dashboard..." />
        </main>
    );
}

export default function Home() {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        const redirectPath = getRedirectPathForStatus(status, session ?? null);
        if (redirectPath) {
            router.push(redirectPath);
        }
    }, [session, status, router]);

    return renderStatusView(status);
}
