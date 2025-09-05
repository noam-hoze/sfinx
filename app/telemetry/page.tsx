"use client";

import React from "react";
import EvidenceReel from "./components/EvidenceReel";
import GapAnalysis from "./components/GapAnalysis";
import WorkstyleDashboard from "./components/WorkstyleDashboard";
import PersistenceFlow from "./components/PersistenceFlow";
import LearningToActionTimeline from "./components/LearningToActionTimeline";
import ConfidenceBuildingCurve from "./components/ConfidenceBuildingCurve";
import { galTelemetryData } from "../../lib/telemetry/mockData";

export default function TelemetryPage() {
    const { candidate, gaps, evidence, chapters, workstyle } = galTelemetryData;
    const [currentVideoTime, setCurrentVideoTime] = React.useState(0);

    const onVideoJump = (timestamp: number) => {
        setCurrentVideoTime(timestamp);
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto p-4">
                {/* Header - Name, Score, Confidence */}
                <div className="mb-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 max-w-4xl mx-auto">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                                {candidate.name.charAt(0)}
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">
                                    {candidate.name}
                                </h1>
                                <p className="text-gray-600 text-lg">
                                    Candidate Profile Story
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-8">
                            <div className="text-center">
                                <div className="text-4xl font-bold text-blue-600 mb-1">
                                    {candidate.matchScore}%
                                </div>
                                <div className="text-sm text-gray-600 font-medium">
                                    MatchScore
                                </div>
                            </div>

                            <div className="inline-block px-6 py-3 rounded-full border text-base font-semibold bg-green-50 border-green-200 text-green-700">
                                High Confidence
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content - Left: Analytics Panels, Right: Video */}
                <div className="flex flex-col xl:flex-row gap-4 xl:gap-6">
                    {/* Left Side - Analytics Panels + Behavioral Graphs */}
                    <div className="w-full xl:w-80 xl:flex-shrink-0 order-2 xl:order-1">
                        <div className="space-y-3 max-h-[calc(100vh-12rem)] overflow-y-auto">
                            <GapAnalysis gaps={gaps} />
                            <WorkstyleDashboard workstyle={workstyle} />

                            {/* Behavioral Graphs */}
                            <div className="bg-white rounded-lg p-2">
                                <div className="flex items-center gap-2 mb-2">
                                    <h2 className="text-sm font-semibold text-gray-900">
                                        Behavior
                                    </h2>
                                </div>
                                <div className="space-y-3">
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
                            </div>
                        </div>
                    </div>

                    {/* Right Side - Evidence Reel (Main Focus) */}
                    <div className="flex-1 xl:max-w-4xl mx-auto xl:mx-0 order-1 xl:order-2">
                        <EvidenceReel
                            chapters={chapters}
                            evidence={evidence}
                            jumpToTime={currentVideoTime}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
