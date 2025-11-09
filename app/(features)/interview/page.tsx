"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { InterviewIDE } from "./components";
import { InterviewProvider } from "app/shared/contexts";
import { AuthGuard } from "app/shared/components";
import DemoProgressHeader from "../demo/components/DemoProgressHeader";

function InterviewPageContent() {
    const searchParams = useSearchParams();
    const isDemoMode = searchParams.get("demo") === "true";

    return (
        <>
            {isDemoMode && <DemoProgressHeader currentStage={2} />}
            <AuthGuard requiredRole="CANDIDATE">
                <InterviewProvider>
                    <Suspense fallback={<div>Loading...</div>}>
                        <InterviewIDE />
                    </Suspense>
                </InterviewProvider>
            </AuthGuard>
        </>
    );
}

export default function InterviewerPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <InterviewPageContent />
        </Suspense>
    );
}
