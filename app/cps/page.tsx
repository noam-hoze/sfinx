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
import { AuthGuard } from "../../lib";

function TelemetryContent() {
    const searchParams = useSearchParams();
    const candidateId = searchParams.get("candidateId");
    const applicationId = searchParams.get("applicationId");

    const [telemetryData, setTelemetryData] = useState<any>(null);
    const [sessions, setSessions] = useState<any[]>([]);
    const [activeSessionIndex, setActiveSessionIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentVideoTime, setCurrentVideoTime] = React.useState(0);
    const [activeTab, setActiveTab] = useState<"benchmarks" | "insights">(
        "benchmarks"
    );
    const [editMode, setEditMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        const fetchTelemetryData = async () => {
            if (!candidateId) {
                // Show empty data if no candidate ID provided
                setTelemetryData(null);
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const query = new URLSearchParams();
                if (applicationId) query.set("applicationId", applicationId);
                const response = await fetch(
                    `/api/candidates/${candidateId}/telemetry?${query.toString()}`
                );

                if (response.ok) {
                    const data = await response.json();
                    // Supports new API shape with sessions[]
                    if (data.sessions) {
                        setTelemetryData({ candidate: data.candidate });
                        setSessions(data.sessions || []);
                        setActiveSessionIndex(0);
                    } else {
                        // Backward compatibility with single-session shape
                        setTelemetryData(data);
                        setSessions([
                            {
                                id: "single",
                                videoUrl: data.videoUrl,
                                duration: data.duration,
                                chapters: data.chapters,
                                gaps: data.gaps,
                                workstyle: data.workstyle,
                                evidence: data.evidence,
                            },
                        ]);
                        setActiveSessionIndex(0);
                    }
                    setError(null);
                } else if (response.status === 404) {
                    // No telemetry data found - show empty data
                    setTelemetryData(null);
                    setError("No telemetry data available for this candidate");
                } else {
                    setError("Failed to load telemetry data");
                    setTelemetryData(null);
                }
            } catch (error) {
                console.error("Error fetching telemetry:", error);
                setError("Failed to load telemetry data");
                setTelemetryData(null);
            } finally {
                setLoading(false);
            }
        };

        fetchTelemetryData();
    }, [candidateId]);

    const { candidate } = telemetryData || {};
    const activeSession = sessions[activeSessionIndex] || {};
    const { gaps, evidence, chapters, workstyle, videoUrl, duration } =
        activeSession;
    const persistenceFlow = activeSession.persistenceFlow || [];
    const learningToAction = activeSession.learningToAction || [];
    const confidenceCurve = activeSession.confidenceCurve || [];

    const onVideoJump = (timestamp: number) => {
        setCurrentVideoTime(timestamp);
    };

    const validateData = () => {
        const errors: string[] = [];

        if (!telemetryData.candidate.name.trim()) {
            errors.push("Candidate name is required");
        }

        if (
            telemetryData.candidate.matchScore < 0 ||
            telemetryData.candidate.matchScore > 100
        ) {
            errors.push("Match score must be between 0 and 100");
        }

        if (telemetryData.workstyle) {
            const workstyleKeys = [
                "iterationSpeed",
                "debugLoops",
                "refactorCleanups",
                "aiAssistUsage",
            ];
            workstyleKeys.forEach((key) => {
                const value = telemetryData.workstyle[key]?.value;
                if (value !== undefined && (value < 0 || value > 100)) {
                    errors.push(`${key} must be between 0 and 100`);
                }
            });
        }

        if (telemetryData.gaps?.gaps) {
            telemetryData.gaps.gaps.forEach((gap: any, index: number) => {
                if (!gap.description.trim()) {
                    errors.push(`Gap ${index + 1} description is required`);
                }
            });
        }

        return errors;
    };

    const handleSave = async () => {
        if (!candidateId || !telemetryData) return;

        const errors = validateData();
        if (errors.length > 0) {
            setValidationErrors(errors);
            return;
        }

        setValidationErrors([]);
        setSaveSuccess(false);
        setSaving(true);
        try {
            const response = await fetch(
                `/api/candidates/${candidateId}/telemetry`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(telemetryData),
                }
            );

            if (response.ok) {
                setEditMode(false);
                setSaveSuccess(true);
                // Clear success message after 3 seconds
                setTimeout(() => setSaveSuccess(false), 3000);
                // Refresh data after save
                const fetchResponse = await fetch(
                    `/api/candidates/${candidateId}/telemetry`
                );
                if (fetchResponse.ok) {
                    const updatedData = await fetchResponse.json();
                    setTelemetryData(updatedData);
                }
            } else {
                throw new Error("Failed to save changes");
            }
        } catch (error) {
            console.error("Error saving telemetry data:", error);
            setError("Failed to save changes");
        } finally {
            setSaving(false);
        }
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

    if (!telemetryData) {
        return <div className="h-screen bg-gray-50 overflow-hidden"></div>;
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
                    <div className="xl:block">
                        {/* Candidate Profile - Minimal Apple Style */}
                        <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-white/20 p-4 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    {candidate.image ? (
                                        <Image
                                            src={candidate.image}
                                            alt={`${candidate.name} profile`}
                                            width={48}
                                            height={48}
                                            className="rounded-full object-cover border-2 border-white shadow-sm"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-gray-300 border-2 border-white shadow-sm" />
                                    )}
                                    <div>
                                        {editMode ? (
                                            <input
                                                type="text"
                                                value={candidate.name}
                                                onChange={(e) => {
                                                    setTelemetryData({
                                                        ...telemetryData,
                                                        candidate: {
                                                            ...candidate,
                                                            name: e.target
                                                                .value,
                                                        },
                                                    });
                                                }}
                                                className="text-lg font-medium text-gray-900 bg-white/50 border border-gray-300 rounded px-2 py-1 w-full"
                                                placeholder="Candidate name"
                                            />
                                        ) : (
                                            <h2 className="text-lg font-medium text-gray-900">
                                                {candidate.name || ""}
                                            </h2>
                                        )}
                                        <p className="text-sm text-gray-600">
                                            Software Engineer
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    {editMode ? (
                                        <div>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={candidate.matchScore}
                                                onChange={(e) => {
                                                    setTelemetryData({
                                                        ...telemetryData,
                                                        candidate: {
                                                            ...candidate,
                                                            matchScore:
                                                                parseInt(
                                                                    e.target
                                                                        .value
                                                                ) || 0,
                                                        },
                                                    });
                                                }}
                                                className="text-2xl font-semibold text-blue-600 bg-white/50 border border-gray-300 rounded px-2 py-1 w-16 text-center"
                                            />
                                            <div className="text-xs text-gray-500 font-medium mt-1">
                                                Match Score
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="text-2xl font-semibold text-blue-600">
                                                {candidate.matchScore}%
                                            </div>
                                            <div className="text-xs text-gray-500 font-medium">
                                                Match Score
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Cell 1 - Candidate Telemetry (top-right) */}
                    <div className="flex items-center justify-between w-full">
                        <div className="w-1/3">
                            {/* Session navigation */}
                            {sessions.length > 1 && (
                                <div className="flex items-center gap-2">
                                    <button
                                        className="px-3 py-1 rounded-lg bg-white/60 border border-white/40 text-gray-700 disabled:opacity-40"
                                        onClick={() =>
                                            setActiveSessionIndex((i) =>
                                                Math.max(0, i - 1)
                                            )
                                        }
                                        disabled={activeSessionIndex === 0}
                                        aria-label="Previous session"
                                    >
                                        ◀
                                    </button>
                                    <div className="text-sm text-gray-700">
                                        Session {activeSessionIndex + 1} /{" "}
                                        {sessions.length}
                                    </div>
                                    <button
                                        className="px-3 py-1 rounded-lg bg-white/60 border border-white/40 text-gray-700 disabled:opacity-40"
                                        onClick={() =>
                                            setActiveSessionIndex((i) =>
                                                Math.min(
                                                    sessions.length - 1,
                                                    i + 1
                                                )
                                            )
                                        }
                                        disabled={
                                            activeSessionIndex ===
                                            sessions.length - 1
                                        }
                                        aria-label="Next session"
                                    >
                                        ▶
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="w-1/3 text-center">
                            <h1 className="text-2xl font-semibold text-gray-800 tracking-tight">
                                Candidate Profile Story
                            </h1>
                        </div>
                        <div className="w-1/3 flex justify-end">
                            <div className="flex gap-2">
                                {!editMode ? (
                                    <button
                                        onClick={() => {
                                            setEditMode(true);
                                            setValidationErrors([]);
                                        }}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                    >
                                        Edit
                                    </button>
                                ) : (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setEditMode(false)}
                                            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium"
                                            disabled={saving}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
                                        >
                                            {saving ? "Saving..." : "Save"}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Success Message */}
                    {saveSuccess && (
                        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center gap-2 text-green-800">
                                <svg
                                    className="w-5 h-5"
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
                                <span className="font-medium">
                                    Changes saved successfully!
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Validation Errors */}
                    {validationErrors.length > 0 && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <h4 className="text-red-800 font-medium mb-2">
                                Please fix the following errors:
                            </h4>
                            <ul className="list-disc list-inside text-red-700 text-sm">
                                {validationErrors.map((error, index) => (
                                    <li key={index}>{error}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Cell 2 - Left Panel (bottom-left) */}
                    <div className="w-full xl:w-auto">
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
                                    {workstyle && (
                                        <WorkstyleDashboard
                                            workstyle={workstyle}
                                            onVideoJump={onVideoJump}
                                            editMode={editMode}
                                            onUpdateWorkstyle={(
                                                updatedWorkstyle
                                            ) => {
                                                // Update UI source of truth (sessions)
                                                setSessions((prev) => {
                                                    const next = [...prev];
                                                    if (
                                                        next[activeSessionIndex]
                                                    ) {
                                                        next[
                                                            activeSessionIndex
                                                        ] = {
                                                            ...next[
                                                                activeSessionIndex
                                                            ],
                                                            workstyle:
                                                                updatedWorkstyle,
                                                        };
                                                    }
                                                    return next;
                                                });
                                                // Keep payload for saving in telemetryData
                                                setTelemetryData(
                                                    (prev: any) => ({
                                                        ...prev,
                                                        workstyle:
                                                            updatedWorkstyle,
                                                    })
                                                );
                                            }}
                                        />
                                    )}
                                    {gaps && (
                                        <GapAnalysis
                                            gaps={gaps}
                                            onVideoJump={onVideoJump}
                                            editMode={editMode}
                                            onUpdateGaps={(updatedGaps) => {
                                                // Update UI source of truth (sessions)
                                                setSessions((prev) => {
                                                    const next = [...prev];
                                                    if (
                                                        next[activeSessionIndex]
                                                    ) {
                                                        next[
                                                            activeSessionIndex
                                                        ] = {
                                                            ...next[
                                                                activeSessionIndex
                                                            ],
                                                            gaps: updatedGaps,
                                                        };
                                                    }
                                                    return next;
                                                });
                                                // Keep payload for saving in telemetryData
                                                setTelemetryData(
                                                    (prev: any) => ({
                                                        ...prev,
                                                        gaps: updatedGaps,
                                                    })
                                                );
                                            }}
                                        />
                                    )}
                                </div>
                            )}

                            {activeTab === "insights" && (
                                <div className="space-y-3 animate-in slide-in-from-left-2 duration-300">
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2">
                                        <PersistenceFlow
                                            data={persistenceFlow}
                                            onVideoJump={onVideoJump}
                                        />
                                    </div>
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2">
                                        <LearningToActionTimeline
                                            data={learningToAction}
                                            onVideoJump={onVideoJump}
                                        />
                                    </div>
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2">
                                        <ConfidenceBuildingCurve
                                            data={confidenceCurve}
                                            onVideoJump={onVideoJump}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cell 3 - Video (bottom-right) */}
                    <div className="w-full xl:w-auto h-full">
                        {/* Lazy-load only active session's video */}
                        {videoUrl ? (
                            <EvidenceReel
                                jumpToTime={currentVideoTime}
                                videoUrl={videoUrl}
                                duration={duration}
                                chapters={chapters}
                            />
                        ) : (
                            <div className="aspect-video bg-gray-200 rounded-xl" />
                        )}
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
