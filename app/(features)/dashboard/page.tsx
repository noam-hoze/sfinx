import { AuthGuard } from "app/shared/components";

import CandidateDashboard from "./CandidateDashboard";

export default function DashboardPage() {
    return (
        <AuthGuard requiredRole="CANDIDATE">
            <CandidateDashboard />
        </AuthGuard>
    );
}
