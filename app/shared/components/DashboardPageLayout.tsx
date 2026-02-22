/**
 * DashboardPageLayout: Reusable layout for company dashboard pages.
 * Inherits the soft purple page background set on the root layout.
 */

import React from "react";

interface DashboardPageLayoutProps {
    title: string;
    subtitle: string;
    action?: React.ReactNode;
    children: React.ReactNode;
}

export default function DashboardPageLayout({
    title,
    subtitle,
    action,
    children,
}: DashboardPageLayoutProps) {
    return (
        <div className="min-h-screen p-8 md:p-12">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold text-gray-900 mb-2 tracking-tight">
                                {title}
                            </h1>
                            <p className="text-gray-500">{subtitle}</p>
                        </div>
                        {action && <div>{action}</div>}
                    </div>
                </div>

                {/* Content */}
                {children}
            </div>
        </div>
    );
}
