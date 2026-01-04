/**
 * DashboardPageLayout: Reusable layout for company dashboard pages
 * Provides consistent structure with title, subtitle, optional actions, and content area
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
        <div className="min-h-screen bg-gray-50 p-12">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold text-gray-900 mb-2">
                                {title}
                            </h1>
                            <p className="text-gray-600">{subtitle}</p>
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

