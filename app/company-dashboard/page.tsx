import { AuthGuard } from "../../lib";

function CompanyDashboardContent() {
    return (
        <main className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">
                    Company Dashboard
                </h1>
                <div className="bg-white rounded-lg shadow p-6">
                    <p className="text-gray-600">
                        Welcome to your company dashboard. This is where
                        you&apos;ll manage your hiring process.
                    </p>
                </div>
            </div>
        </main>
    );
}

export default function CompanyDashboard() {
    return (
        <AuthGuard requiredRole="COMPANY">
            <CompanyDashboardContent />
        </AuthGuard>
    );
}
