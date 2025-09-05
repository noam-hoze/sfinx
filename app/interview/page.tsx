import { InterviewIDE } from "./components";
import { InterviewProvider } from "../../lib/";

export default function InterviewerPage() {
    return (
        <InterviewProvider>
            <InterviewIDE />
        </InterviewProvider>
    );
}
