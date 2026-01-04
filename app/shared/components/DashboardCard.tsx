/**
 * DashboardCard: Reusable card component with consistent hover effects
 * Provides Apple-like animations and styling for dashboard content
 */

import React from "react";

interface DashboardCardProps {
    onClick?: () => void;
    children: React.ReactNode;
    className?: string;
}

export default function DashboardCard({
    onClick,
    children,
    className = "",
}: DashboardCardProps) {
    const baseClasses =
        "bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-lg hover:border-gray-300 transition-all duration-300 ease-out hover:scale-105";

    const clickableClasses = onClick ? "cursor-pointer" : "";

    const combinedClasses = `${baseClasses} ${clickableClasses} ${className}`.trim();

    if (onClick) {
        return (
            <button
                onClick={onClick}
                className={`${combinedClasses} text-left`}
                type="button"
            >
                {children}
            </button>
        );
    }

    return <div className={combinedClasses}>{children}</div>;
}

