import { AuthGuard } from "app/shared/components";
import AllApplicants from "./AllApplicants";

export default function CompanyDashboard() {
    return (
        <AuthGuard requiredRole="COMPANY">
            <AllApplicants />
        </AuthGuard>
    );
}
