import { Suspense } from "react";
import { InterviewIDE } from "../components";
import { InterviewProvider } from "app/shared/contexts";
import { AuthGuard } from "app/shared/components";

export default function InterviewTrainingPage() {
    return (
        <AuthGuard requiredRole="ANY">
            <InterviewProvider>
                <Suspense fallback={<div>Loading...</div>}>
                    <InterviewIDE />
                </Suspense>
            </InterviewProvider>
        </AuthGuard>
    );
}
