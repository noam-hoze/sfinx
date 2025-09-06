"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import EvidenceReel from "./components/EvidenceReel";
import GapAnalysis from "./components/GapAnalysis";
import WorkstyleDashboard from "./components/WorkstyleDashboard";
import PersistenceFlow from "./components/PersistenceFlow";
import LearningToActionTimeline from "./components/LearningToActionTimeline";
import ConfidenceBuildingCurve from "./components/ConfidenceBuildingCurve";
import { noamTelemetryData, AuthGuard } from "../../lib";

function TelemetryContent() {
    const searchParams = useSearchParams();
    const candidateId = searchParams.get("candidateId");

    const [telemetryData, setTelemetryData] = useState<any>(noamTelemetryData);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentVideoTime, setCurrentVideoTime] = React.useState(0);
    const [activeTab, setActiveTab] = useState<"benchmarks" | "insights">(
        "benchmarks"
    );

    useEffect(() => {
        const fetchTelemetryData = async () => {
            if (!candidateId) {
                // Use default mock data if no candidate ID provided
                setTelemetryData(noamTelemetryData);
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const response = await fetch(
                    `/api/candidates/${candidateId}/telemetry`
                );

                if (response.ok) {
                    const data = await response.json();
                    setTelemetryData(data);
                    setError(null);
                } else if (response.status === 404) {
                    // No telemetry data found, use mock data as fallback
                    setTelemetryData(noamTelemetryData);
                    setError(null);
                } else {
                    setError("Failed to load telemetry data");
                }
            } catch (error) {
                console.error("Error fetching telemetry:", error);
                setError("Failed to load telemetry data");
                // Fallback to mock data
                setTelemetryData(noamTelemetryData);
            } finally {
                setLoading(false);
            }
        };

        fetchTelemetryData();
    }, [candidateId]);

    const { candidate, gaps, evidence, chapters, workstyle } = telemetryData;

    const onVideoJump = (timestamp: number) => {
        setCurrentVideoTime(timestamp);
    };

    if (loading) {
        return (
            <div className="h-screen bg-gray-50 overflow-hidden flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-4 text-gray-600">
                        Loading candidate telemetry...
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-screen bg-gray-50 overflow-hidden flex items-center justify-center">
                <div className="text-center">
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
                        Error Loading Telemetry
                    </h3>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen bg-gray-50 overflow-hidden">
            <div className="max-w-7xl mx-auto p-4 h-full">
                {/* 2x2 Grid Layout */}
                <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] xl:grid-rows-[auto_1fr] gap-4 xl:gap-6 h-[calc(100vh-2rem)]">
                    {/* Cell 0 - Empty (top-left) */}
                    <div className="hidden xl:block"></div>

                    {/* Cell 1 - Candidate Telemetry (top-right) */}
                    <div className="text-center xl:text-center xl:flex xl:items-center xl:justify-center">
                        <h1 className="text-2xl font-semibold text-gray-800 tracking-tight">
                            Candidate Profile Story
                        </h1>
                    </div>

                    {/* Cell 2 - Left Panel (bottom-left) */}
                    <div className="w-full xl:w-auto">
                        {/* Candidate Profile - Minimal Apple Style */}
                        <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-white/20 p-6 mb-4 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <Image
                                        src={
                                            candidate.image ||
                                            "/images/noam-profile.jpeg"
                                        }
                                        alt={`${candidate.name} profile`}
                                        width={48}
                                        height={48}
                                        className="rounded-full object-cover border-2 border-white shadow-sm"
                                    />
                                    <div>
                                        <h2 className="text-lg font-medium text-gray-900">
                                            {candidate.name}
                                        </h2>
                                        <p className="text-sm text-gray-600">
                                            Software Engineer
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-semibold text-blue-600">
                                        {candidate.matchScore}%
                                    </div>
                                    <div className="text-xs text-gray-500 font-medium">
                                        Match Score
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Apple-Style Tabs */}
                        <div className="bg-white/40 backdrop-blur-sm rounded-2xl border border-white/20 p-1 shadow-sm mb-2">
                            <div className="flex">
                                <button
                                    onClick={() => setActiveTab("benchmarks")}
                                    className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ease-out ${
                                        activeTab === "benchmarks"
                                            ? "bg-blue-500 text-white shadow-md"
                                            : "text-gray-600 hover:text-gray-900 hover:bg-white/40"
                                    }`}
                                >
                                    Benchmarks
                                </button>
                                <button
                                    onClick={() => setActiveTab("insights")}
                                    className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ease-out ${
                                        activeTab === "insights"
                                            ? "bg-blue-500 text-white shadow-md"
                                            : "text-gray-600 hover:text-gray-900 hover:bg-white/40"
                                    }`}
                                >
                                    Insights
                                </button>
                            </div>
                        </div>

                        {/* Tab Content */}
                        <div className="space-y-3 max-h-[calc(100vh-18rem)] overflow-y-auto border-t border-l border-r border-white/40 border-b-2 border-b-white/60 rounded-2xl bg-white/20 backdrop-blur-sm p-3 shadow-sm">
                            {activeTab === "benchmarks" && (
                                <div className="space-y-3 animate-in slide-in-from-right-2 duration-300">
                                    <WorkstyleDashboard
                                        workstyle={workstyle}
                                        onVideoJump={onVideoJump}
                                    />
                                    <GapAnalysis
                                        gaps={gaps}
                                        onVideoJump={onVideoJump}
                                    />
                                </div>
                            )}

                            {activeTab === "insights" && (
                                <div className="space-y-3 animate-in slide-in-from-left-2 duration-300">
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2">
                                        <PersistenceFlow
                                            onVideoJump={onVideoJump}
                                        />
                                    </div>
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2">
                                        <LearningToActionTimeline
                                            onVideoJump={onVideoJump}
                                        />
                                    </div>
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2">
                                        <ConfidenceBuildingCurve
                                            onVideoJump={onVideoJump}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cell 3 - Video (bottom-right) */}
                    <div className="w-full xl:w-auto h-full">
                        <EvidenceReel
                            chapters={chapters}
                            evidence={evidence}
                            jumpToTime={currentVideoTime}
                            onChapterClick={onVideoJump}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function TelemetryPage() {
    return (
        <AuthGuard requiredRole="COMPANY">
            <TelemetryContent />
        </AuthGuard>
    );
}
