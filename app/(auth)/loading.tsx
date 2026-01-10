import LoadingScreen from "app/shared/components/LoadingScreen";

/**
 * Shared loading state for all auth routes during navigation.
 * Applies to: login, signup.
 */
export default function Loading() {
    return <LoadingScreen variant="auth" />;
}

