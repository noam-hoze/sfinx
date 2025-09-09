"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

interface Candidate {
    id: string;
    name: string;
    email: string;
    image: string | null;
    jobTitle: string;
    location: string;
    appliedJob: string;
    appliedAt: string;
    status: string;
}

function CompanyDashboardContent() {
    const router = useRouter();
    const [jobRoleFilter, setJobRoleFilter] = useState("");
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchCandidates = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (jobRoleFilter) params.append("jobRole", jobRoleFilter);

            const response = await fetch(
                `/api/company/candidates?${params.toString()}`
            );

            if (response.ok) {
                const data = await response.json();
                setCandidates(data.candidates);
                setError(null);
            } else {
                setError("Failed to load candidates");
            }
        } catch (error) {
            console.error("Error fetching candidates:", error);
            setError("Failed to load candidates");
        } finally {
            setLoading(false);
        }
    }, [jobRoleFilter]);

    useEffect(() => {
        fetchCandidates();
    }, [fetchCandidates]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case "PENDING":
                return "bg-yellow-100 text-yellow-800";
            case "REVIEWED":
                return "bg-blue-100 text-blue-800";
            case "INTERVIEWING":
                return "bg-purple-100 text-purple-800";
            case "ACCEPTED":
                return "bg-green-100 text-green-800";
            case "REJECTED":
                return "bg-red-100 text-red-800";
            default:
                return "bg-gray-100 text-gray-800";
        }
    };

    const handleCandidateClick = (
        candidateId: string,
        applicationId?: string
    ) => {
        const search = new URLSearchParams();
        search.set("candidateId", candidateId);
        if (applicationId) search.set("applicationId", applicationId);
        router.push(`/cps?${search.toString()}`);
    };

    return (
        <div className="space-y-8">
            {/* Filter Form */}
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-sm">
                <div className="max-w-md">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Filter by Job Role
                    </label>
                    <input
                        type="text"
                        placeholder="e.g. Software Engineer, Product Manager..."
                        value={jobRoleFilter}
                        onChange={(e) => setJobRoleFilter(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all duration-300 bg-white/50 backdrop-blur-sm"
                    />
                </div>
                <div className="mt-4 text-sm text-gray-600">
                    {candidates.length} candidates found
                </div>
            </div>

            {/* Candidates Grid */}
            {loading ? (
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-4 text-gray-600">Loading candidates...</p>
                </div>
            ) : error ? (
                <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                        <svg
                            className="w-8 h-8 text-red-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                            />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Error Loading Candidates
                    </h3>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button
                        onClick={fetchCandidates}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {candidates.map((candidate, index) => (
                        <div
                            key={candidate.id}
                            onClick={() =>
                                handleCandidateClick(
                                    (candidate as any).id,
                                    (candidate as any).applicationId
                                )
                            }
                            className="group bg-white/60 backdrop-blur-sm rounded-2xl border border-white/20 p-6 hover:bg-white/80 hover:shadow-lg transition-all duration-300 ease-out hover:scale-105 cursor-pointer"
                            style={{
                                animationDelay: `${index * 50}ms`,
                                animation: "fadeInUp 0.5s ease-out forwards",
                            }}
                        >
                            {/* Candidate Avatar */}
                            <div className="relative w-20 h-20 mx-auto mb-4 rounded-full overflow-hidden bg-gray-200">
                                <Image
                                    src={
                                        candidate.image ||
                                        "/images/noam-profile.jpeg"
                                    }
                                    alt={`${candidate.name} profile`}
                                    fill
                                    sizes="80px"
                                    className="object-cover"
                                />
                            </div>

                            {/* Candidate Info */}
                            <div className="text-center">
                                <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                                    {candidate.name}
                                </h3>
                                <p className="text-sm text-gray-600 mb-1">
                                    {candidate.jobTitle || "Candidate"}
                                </p>
                                <p className="text-xs text-gray-500 mb-2">
                                    {candidate.location ||
                                        "Location not specified"}
                                </p>
                                <p className="text-xs text-gray-500 mb-3">
                                    Applied for: {candidate.appliedJob}
                                </p>

                                {/* Status Badge */}
                                <span
                                    className={`inline-block px-2 py-1 text-xs rounded-full ${getStatusColor(
                                        candidate.status
                                    )}`}
                                >
                                    {candidate.status}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* No Results */}
            {!loading && !error && candidates.length === 0 && (
                <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                        <svg
                            className="w-8 h-8 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                        No candidates found
                    </h3>
                    <p className="text-gray-600">
                        Try adjusting your search criteria
                    </p>
                </div>
            )}

            <style jsx>{`
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div>
    );
}

export default CompanyDashboardContent;
