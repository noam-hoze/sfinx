"use client";

import React, { useState } from "react";
import Image from "next/image";
import EvidenceReel from "./components/EvidenceReel";
import GapAnalysis from "./components/GapAnalysis";
import WorkstyleDashboard from "./components/WorkstyleDashboard";
import PersistenceFlow from "./components/PersistenceFlow";
import LearningToActionTimeline from "./components/LearningToActionTimeline";
import ConfidenceBuildingCurve from "./components/ConfidenceBuildingCurve";
import { galTelemetryData, AuthGuard } from "../../lib";

function TelemetryContent() {
    const { candidate, gaps, evidence, chapters, workstyle } = galTelemetryData;
    const [currentVideoTime, setCurrentVideoTime] = React.useState(0);
    const [activeTab, setActiveTab] = useState<"benchmarks" | "insights">(
        "benchmarks"
    );

    const onVideoJump = (timestamp: number) => {
        setCurrentVideoTime(timestamp);
    };

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
                                        src="/gal-profile.jpeg"
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
