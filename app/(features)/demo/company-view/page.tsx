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
                className="max-w-2xl w-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: isLoading ? 0 : 1 }}
                transition={{ duration: 0.5 }}
            >
                {/* Title Section */}
                <div className="flex flex-col items-center mb-8">
                    <div className="relative mb-6">
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
                    <h1 className="text-4xl font-semibold text-gray-800 mb-4">
                        Interview Complete
                    </h1>
                    <p className="text-lg text-gray-600 text-center">
                        Great job! Now let&apos;s switch perspectives.
                    </p>
                </div>

                {/* Two-stage flow visualization */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* Stage 1: Candidate */}
                    <div className="bg-white rounded-2xl p-8 border-2 border-gray-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center font-bold">
                                1
                            </div>
                            <h2 className="text-2xl font-semibold text-gray-900">Candidate</h2>
                        </div>
                        <p className="text-gray-600">
                            Complete a technical interview for Frontend Engineer at Meta
                        </p>
                    </div>

                    {/* Stage 2: Company */}
                    <div className="bg-white rounded-2xl p-8 border-2 border-sfinx-purple shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-sfinx-purple text-white flex items-center justify-center font-bold">
                                2
                            </div>
                            <h2 className="text-2xl font-semibold text-gray-900">Company</h2>
                        </div>
                        <p className="text-gray-600">
                            Review results, compare candidates, and see detailed analytics
                        </p>
                    </div>
                </div>

                {/* CTA Button */}
                <button
                    onClick={handleViewReport}
                    disabled={isLoading}
                    className="w-full px-8 py-4 bg-sfinx-purple text-white rounded-lg font-medium text-lg hover:opacity-90 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed disabled:hover:opacity-100"
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

