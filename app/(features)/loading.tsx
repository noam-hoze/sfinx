import { SfinxSpinner } from "app/shared/components";

/**
 * Shared loading state for all feature routes during navigation.
 * Applies to: job-search, company-dashboard, interview, cps, settings, practice, mentors, demo.
 */
export default function Loading() {
    return (
        <div className="min-h-screen flex items-center justify-center">
            <SfinxSpinner size="lg" title="Loading" messages="Just a moment..." />
        </div>
    );
}

