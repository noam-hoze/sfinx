import { Suspense } from "react";
import { InterviewIDE } from "./components";
import { InterviewProvider, AuthGuard } from "../contexts";

export default function InterviewerPage() {
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
