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
    applicationId?: string;
    matchScore?: number | null;
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
                // Enrich candidates with latest match score (per application when available)
                const candidatesWithScores: Candidate[] = await Promise.all(
                    (data.candidates || []).map(async (c: any) => {
                        try {
                            const url = c.applicationId
                                ? `/api/candidates/${
                                      c.id
                                  }/telemetry?applicationId=${encodeURIComponent(
                                      c.applicationId
                                  )}`
                                : `/api/candidates/${c.id}/telemetry`;
                            const res = await fetch(url);
                            if (res.ok) {
                                const payload = await res.json();
                                const score =
                                    payload?.candidate?.matchScore ?? null;
                                return { ...c, matchScore: score } as Candidate;
                            }
                        } catch (e) {
                            // noop – fallback below
                        }
                        return { ...c, matchScore: null } as Candidate;
                    })
                );
                const sorted = [...candidatesWithScores].sort(
                    (a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1)
                );
                setCandidates(sorted);
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

    const getMatchScoreColor = (score: number) => {
        if (score >= 80) return "text-green-600";
        if (score >= 60) return "text-yellow-600";
        return "text-red-600";
    };

    const topPerformer = candidates[0];
    const otherCandidates = candidates.slice(1);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_520px] gap-6 items-start">
                {/* Left: Filters + Candidates */}
                <div className="space-y-6">
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
                                onChange={(e) =>
                                    setJobRoleFilter(e.target.value)
                                }
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
                            <p className="mt-4 text-gray-600">
                                Loading candidates...
                            </p>
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
                            {otherCandidates.map((candidate, index) => (
                                <div
                                    key={candidate.id}
                                    onClick={() =>
                                        handleCandidateClick(
                                            (candidate as any).id,
                                            (candidate as any).applicationId
                                        )
                                    }
                                    className="group relative bg-white/60 backdrop-blur-sm rounded-2xl border border-white/20 p-6 hover:bg-white/80 hover:shadow-lg transition-all duration-300 ease-out hover:scale-105 cursor-pointer"
                                    style={{
                                        animationDelay: `${index * 50}ms`,
                                        animation:
                                            "fadeInUp 0.5s ease-out forwards",
                                    }}
                                >
                                    {candidate.matchScore !== null &&
                                        candidate.matchScore !== undefined && (
                                            <div className="absolute top-3 right-3 bg-white/80 border border-gray-200 rounded-lg px-2 py-1 shadow-sm">
                                                <span
                                                    className={`text-sm font-semibold ${getMatchScoreColor(
                                                        candidate.matchScore
                                                    )}`}
                                                >
                                                    {candidate.matchScore}%
                                                </span>
                                            </div>
                                        )}
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
                    {!loading && !error && otherCandidates.length === 0 && (
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
                </div>

                {/* Right: Top Performer Benchmark */}
                <div className="xl:sticky" style={{ top: "17.5vh" }}>
                    {topPerformer && (
                        <div className="bg-white/80 backdrop-blur rounded-2xl border border-white/40 shadow-md p-6 xl:p-10 min-h-[65vh] flex flex-col">
                            <div className="flex items-start justify-between mb-6">
                                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                                    Benchmark
                                </span>
                            </div>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow">
                                    <Image
                                        src={
                                            topPerformer.image ||
                                            "/images/noam-profile.jpeg"
                                        }
                                        alt={`${topPerformer.name} profile`}
                                        fill
                                        sizes="96px"
                                        className="object-cover"
                                    />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-gray-900">
                                        {topPerformer.name}
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                        {topPerformer.jobTitle || "Engineer"}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        Sets the performance benchmark. All
                                        scores compare to this engineer.
                                    </p>
                                </div>
                            </div>
                            {/* Strong traits */}
                            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                                    Strong traits for this role
                                </h4>
                                <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
                                    <li>
                                        Rapid iteration with consistent success
                                    </li>
                                    <li>Robust loading and error handling</li>
                                    <li>
                                        High-quality refactors and code hygiene
                                    </li>
                                    <li>
                                        Accessibility-first mindset (ARIA,
                                        keyboard)
                                    </li>
                                    <li>
                                        Minimal AI reliance; clear original work
                                    </li>
                                </ul>
                            </div>
                            <div className="mt-auto flex items-center justify-start">
                                <div className="text-xs text-gray-500">
                                    Applied for: {topPerformer.appliedJob}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

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
