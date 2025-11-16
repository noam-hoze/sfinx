/**
 * Demo company view page - Stage 3 of the demo flow.
 * Context switch page transitioning from candidate to hiring manager perspective.
 */

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { motion } from "framer-motion";

function CompanyViewContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const candidateId = searchParams.get("candidateId");
    const applicationId = searchParams.get("applicationId");
    const [isLoading, setIsLoading] = useState(false);

    // Prefetch CPS page in background for instant navigation
    useEffect(() => {
        router.prefetch(`/cps?demo=true&candidateId=${candidateId}&applicationId=${applicationId}`);
    }, [router, candidateId, applicationId]);

    const handleViewReport = () => {
        setIsLoading(true);
        router.push(`/cps?demo=true&candidateId=${candidateId}&applicationId=${applicationId}`);
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center p-4">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="bg-white rounded-3xl shadow-2xl border border-gray-200 p-12 max-w-2xl w-full flex flex-col items-center"
            >
                {/* Content */}
                <div className="flex flex-col items-center mb-8">
                    {/* Checkmark with gradient background - matching Background Complete screen */}
                    <div className="relative mb-8">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center shadow-lg">
                            <svg
                                className="w-10 h-10 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                />
                            </svg>
                        </div>
                    </div>
                    
                    <h1 className="text-4xl font-semibold text-gray-800 mb-6">
                        Interview Complete
                    </h1>
                    
                    <p className="text-lg text-gray-600 mb-8 text-center">
                        Great job! Now let&apos;s switch perspectives.
                    </p>
                </div>

                {/* Instructions */}
                <div className="bg-gray-50 rounded-xl p-6 mb-8 w-full">
                    <h2 className="text-xl font-medium text-gray-900 mb-4">
                        View as Hiring Manager
                    </h2>
                    <p className="text-gray-700 leading-relaxed">
                        You&apos;ll now see the comprehensive interview report that hiring
                        managers receive. This includes detailed analysis of your
                        performance, technical skills assessment, and behavioral insights.
                    </p>
                </div>

                {/* Button */}
                <button
                    onClick={handleViewReport}
                    disabled={isLoading}
                    className="px-8 py-4 bg-sfinx-purple text-white rounded-lg font-medium text-lg hover:opacity-90 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed disabled:hover:opacity-100"
                >
                    {isLoading ? "Loading..." : "View Interview Report"}
                </button>
            </motion.div>
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

