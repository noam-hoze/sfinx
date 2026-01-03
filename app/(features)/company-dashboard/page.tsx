import { AuthGuard } from "app/shared/components";
import ApplicantsByJob from "./ApplicantsByJob";

export default function CompanyDashboard() {
    return (
        <AuthGuard requiredRole="COMPANY">
            <ApplicantsByJob />
        </AuthGuard>
    );
}
