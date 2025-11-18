"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { InterviewIDE } from "./components";
import { InterviewProvider } from "app/shared/contexts";
import { AuthGuard } from "app/shared/components";

function InterviewPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    
    useEffect(() => {
        // Guard: Only allow access if coming from background interview
        const hasAutoStartFlag = sessionStorage.getItem("sfinx-demo-autostart") === "true";
        
        if (!hasAutoStartFlag) {
            // Redirect to background interview with current params
            const jobId = searchParams.get("jobId") || "meta-frontend-engineer";
            const companyId = searchParams.get("companyId") || "meta";
            router.push(`/background-interview?jobId=${jobId}&companyId=${companyId}`);
        }
    }, [router, searchParams]);
    
    return (
        <AuthGuard requiredRole="CANDIDATE">
            <InterviewProvider>
                <Suspense fallback={<div>Loading...</div>}>
                    <InterviewIDE />
                </Suspense>
            </InterviewProvider>
        </AuthGuard>
    );
}

export default function InterviewerPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <InterviewPageContent />
        </Suspense>
    );
}
