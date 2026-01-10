import LoadingScreen from "app/shared/components/LoadingScreen";

/**
 * Shared loading state for all feature routes during navigation.
 * Applies to: job-search, company-dashboard, interview, cps, settings, practice, mentors, demo.
 */
export default function Loading() {
    return <LoadingScreen variant="default" />;
}

