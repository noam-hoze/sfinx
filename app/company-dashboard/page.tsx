import { AuthGuard } from "../components";
import CompanyDashboardContent from "./content";

function CompanyDashboardContentWrapper() {
    return (
        <main className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                <CompanyDashboardContent />
            </div>
        </main>
    );
}

export default function CompanyDashboard() {
    return (
        <AuthGuard requiredRole="COMPANY">
            <CompanyDashboardContentWrapper />
        </AuthGuard>
    );
}
