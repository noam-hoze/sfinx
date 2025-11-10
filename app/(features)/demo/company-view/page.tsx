/**
 * Demo company view page - Stage 3 of the demo flow.
 * Context switch page transitioning from candidate to hiring manager perspective.
 */

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

function CompanyViewContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const candidateId = searchParams.get("candidateId");
    const applicationId = searchParams.get("applicationId");

    // Prefetch CPS page in background for instant navigation
    useEffect(() => {
        router.prefetch(`/cps?demo=true&candidateId=${candidateId}&applicationId=${applicationId}`);
    }, [router, candidateId, applicationId]);

    const handleViewReport = () => {
        router.push(`/cps?demo=true&candidateId=${candidateId}&applicationId=${applicationId}`);
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-3xl mx-auto px-4 py-16">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-6">
                            <svg
                                className="w-8 h-8 text-blue-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                        </div>

                        <h1 className="text-4xl font-semibold text-gray-900 mb-4">
                            Interview Complete
                        </h1>

                        <p className="text-lg text-gray-600 mb-2">
                            Great job! Now let's switch perspectives.
                        </p>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-6 mb-8">
                        <h2 className="text-xl font-medium text-gray-900 mb-4">
                            View as Hiring Manager
                        </h2>
                        <p className="text-gray-700 leading-relaxed">
                            You'll now see the comprehensive interview report that hiring
                            managers receive. This includes detailed analysis of your
                            performance, technical skills assessment, and behavioral insights.
                        </p>
                    </div>

                    <button
                        onClick={handleViewReport}
                        className="w-full bg-blue-600 text-white text-lg font-medium py-4 px-8 rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        View Interview Report
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function CompanyViewPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <CompanyViewContent />
        </Suspense>
    );
}

