import InterviewerContent from "./AIInterviewerSession";
import { InterviewProvider } from "../../lib/interview/context";

export default function InterviewerPage() {
    return (
        <InterviewProvider>
            <InterviewerContent />
        </InterviewProvider>
    );
}
