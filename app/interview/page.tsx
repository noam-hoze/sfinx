import { InterviewerSession } from "./components";
import { InterviewProvider } from "../../lib/interview";

export default function InterviewerPage() {
    return (
        <InterviewProvider>
            <InterviewerSession />
        </InterviewProvider>
    );
}
