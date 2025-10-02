import AuthGuard from "../../../shared/components/AuthGuard";
import InterviewIDE from "../components/InterviewIDE";

export default function TrainingPage() {
    return (
        <AuthGuard requiredRole="COMPANY">
            <InterviewIDE
                interviewer="HUMAN"
                candidate="OPENAI"
                candidateName="Larry (candidate)"
            />
        </AuthGuard>
    );
}
