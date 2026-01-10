import SfinxSpinner from "./SfinxSpinner";

interface LoadingScreenProps {
    variant?: "auth" | "default";
    title?: string;
    message?: string;
}

/**
 * Shared loading screen component used across route groups.
 * @param variant - "auth" for branded gradient (login/signup), "default" for plain background
 */
export default function LoadingScreen({ 
    variant = "default",
    title = "Loading",
    message = "Just a moment..."
}: LoadingScreenProps) {
    const backgroundClasses = variant === "auth"
        ? "min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4"
        : "min-h-screen flex items-center justify-center";

    return (
        <div className={backgroundClasses}>
            <SfinxSpinner size="lg" title={title} messages={message} />
        </div>
    );
}
