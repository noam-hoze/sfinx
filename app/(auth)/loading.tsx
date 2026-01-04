import { SfinxSpinner } from "app/shared/components";

/**
 * Shared loading state for all auth routes during navigation.
 * Applies to: login, signup.
 */
export default function Loading() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
            <SfinxSpinner size="lg" title="Loading" messages="Just a moment..." />
        </div>
    );
}

