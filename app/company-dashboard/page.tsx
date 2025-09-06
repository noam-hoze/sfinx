import { AuthGuard } from "../../lib";
import CompanyDashboardContent from "./content";

function CompanyDashboardContentWrapper() {
    return (
        <main className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-semibold text-gray-800 tracking-tight mb-8">
                    Company Dashboard
                </h1>
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
