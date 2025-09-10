import { Suspense } from "react";
import { InterviewIDE } from "app/(features)/interview/components";
import { InterviewProvider } from "app/shared/contexts";
import { AuthGuard } from "app/shared/components";

export default function PracticePage() {
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
