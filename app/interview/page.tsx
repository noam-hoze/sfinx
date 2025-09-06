import { Suspense } from "react";
import { InterviewIDE } from "./components";
import { InterviewProvider } from "../../lib/";

export default function InterviewerPage() {
    return (
        <InterviewProvider>
            <Suspense fallback={<div>Loading...</div>}>
                <InterviewIDE />
            </Suspense>
        </InterviewProvider>
    );
}
