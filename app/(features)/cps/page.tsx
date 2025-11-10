"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import EvidenceReel from "./components/EvidenceReel";
import GapAnalysis from "./components/GapAnalysis";
import WorkstyleDashboard from "./components/WorkstyleDashboard";
import ImprovementChart from "./components/ImprovementChart";
import TextSummary from "./components/TextSummary";
import { AuthGuard } from "app/shared/components";
import { log } from "app/shared/services";

function TelemetryContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const isDemoMode = searchParams.get("demo") === "true";
    const candidateId = searchParams.get("candidateId");
    const applicationId = searchParams.get("applicationId");

    const [telemetryData, setTelemetryData] = useState<any>(null);
    const [sessions, setSessions] = useState<any[]>([]);
    const [activeSessionIndex, setActiveSessionIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentVideoTime, setCurrentVideoTime] = React.useState(0);
    const [jumpKey, setJumpKey] = React.useState(0);
    const [activeTab, setActiveTab] = useState<
        "benchmarks" | "gaps"
    >("benchmarks");
    const [editMode, setEditMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [storyExpanded, setStoryExpanded] = useState(false);
    const [mainContentTab, setMainContentTab] = useState<"summary" | "evidence" | "improvement">("summary");
    const [seriesVisible, setSeriesVisible] = useState({
        match: true,
        iter: false,
        debug: false,
        ai: false,
    });
    const [backgroundSummary, setBackgroundSummary] = useState<any>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);

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
                    console.log("[CPS] Telemetry data received:", data);
                    // Supports new API shape with sessions[]
                    if (data.sessions) {
                        console.log("[CPS] Sessions found:", data.sessions.length);
                        console.log("[CPS] First session videoUrl:", data.sessions[0]?.videoUrl);
                        setTelemetryData({ candidate: data.candidate });
                        setSessions(data.sessions || []);
                        setActiveSessionIndex(0);
                    } else {
                        // Backward compatibility with single-session shape
                        console.log("[CPS] Using legacy format, videoUrl:", data.videoUrl);
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
                log.error("Error fetching telemetry:", error);
                setError("Failed to load telemetry data");
                setTelemetryData(null);
            } finally {
                setLoading(false);
            }
        };

        fetchTelemetryData();
    }, [candidateId]);

    // Fetch background summary for active session
    useEffect(() => {
        const fetchBackgroundSummary = async () => {
            const sessionId = activeSession?.id;
            if (!sessionId || sessionId === "single") {
                setBackgroundSummary(null);
                return;
            }

            try {
                setSummaryLoading(true);
                const response = await fetch(
                    `/api/interviews/session/${sessionId}/background-summary`
                );

                if (response.ok) {
                    const data = await response.json();
                    setBackgroundSummary(data.summary);
                } else {
                    setBackgroundSummary(null);
                }
            } catch (error) {
                log.error("Error fetching background summary:", error);
                setBackgroundSummary(null);
            } finally {
                setSummaryLoading(false);
            }
        };

        fetchBackgroundSummary();
    }, [activeSessionIndex, sessions]);

    const { candidate } = telemetryData || {};
    const activeSession = sessions[activeSessionIndex] || {};
    console.log("[CPS] Active session:", activeSession);
    const formatMonthYear = (dateIso?: string) =>
        dateIso
            ? new Date(dateIso).toLocaleDateString(undefined, {
                  month: "short",
                  year: "2-digit",
              })
            : "";
    const { gaps, evidence, chapters, workstyle, videoUrl, duration } =
        activeSession;
    console.log("[CPS] Extracted videoUrl:", videoUrl, "duration:", duration);
    const persistenceFlow = activeSession.persistenceFlow || [];
    const learningToAction = activeSession.learningToAction || [];
    const confidenceCurve = activeSession.confidenceCurve || [];

    const activeMatchScore: number | null =
        (activeSession && activeSession.matchScore !== undefined
            ? activeSession.matchScore
            : candidate?.matchScore) ?? null;

    // Build a lightweight story from available data (no persistence)
    const topMetricKey = (() => {
        if (!workstyle) return null;
        const metricKeys = [
            "iterationSpeed",
            "debugLoops",
            "aiAssistUsage",
        ] as const;
        let bestKey: (typeof metricKeys)[number] | null = null;
        let bestValue = -1;
        metricKeys.forEach((key) => {
            const value = workstyle?.[key]?.value ?? -1;
            if (value > bestValue) {
                bestValue = value;
                bestKey = key;
            }
        });
        return bestKey;
    })();

    const topMetricLabelMap: Record<string, string> = {
        iterationSpeed: "Iteration Speed",
        debugLoops: "Debug Loops",
        aiAssistUsage: "External Tool Usage",
    };
    const topMetricLabel = topMetricKey
        ? topMetricLabelMap[topMetricKey]
        : null;

    const gapsCount: number = gaps?.gaps?.length || 0;
    const shortStory: string = (() => {
        if (!candidate) return "";
        const parts: string[] = [];
        parts.push(
            `${
                candidate.name || "The candidate"
            } scored ${activeMatchScore}% match.`
        );
        if (topMetricLabel) parts.push(`Strongest signal: ${topMetricLabel}.`);
        parts.push(
            gapsCount > 0
                ? `${gapsCount} gap${gapsCount > 1 ? "s" : ""} identified.`
                : "No significant gaps identified."
        );
        return parts.join(" ");
    })();

    const longStory: string = (() => {
        if (candidate?.story && candidate.story.trim()) return candidate.story;
        if (!candidate) return shortStory;
        const more: string[] = [];
        if (workstyle && topMetricKey) {
            const v = workstyle[topMetricKey]?.value ?? undefined;
            const lvl = workstyle[topMetricKey]?.level ?? undefined;
            if (v !== undefined)
                more.push(
                    `Workstyle shows ${topMetricLabel?.toLowerCase()} at ${v}%${
                        lvl ? ` (${lvl})` : ""
                    }.`
                );
        }
        if (gapsCount > 0) {
            const firstSeverity = gaps?.gaps?.[0]?.severity ?? "";
            more.push(
                `Focus areas include ${
                    firstSeverity ? firstSeverity.toLowerCase() + " " : ""
                }gaps to address.`
            );
        }
        return `${shortStory} ${more.join(" ")}`.trim();
    })();

    const onVideoJump = (timestamp: number) => {
        setCurrentVideoTime(timestamp);
        setJumpKey((k) => k + 1);
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
            log.error("Error saving telemetry data:", error);
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
        <div className={`bg-gray-50 ${mainContentTab === "summary" ? "min-h-screen" : "h-screen overflow-hidden"}`}>
            <div className={`max-w-7xl mx-auto p-4 ${mainContentTab === "summary" ? "" : "h-full"}`}>
                {isDemoMode && (
                    <div className="mb-4 flex justify-end">
                        <button
                            onClick={() => router.push(`/demo/ranked-candidates?candidateId=${candidateId}&applicationId=${applicationId}`)}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            View All Candidates
                        </button>
                    </div>
                )}
                {/* 2x2 Grid Layout */}
                <div className={`grid grid-cols-1 xl:grid-cols-[320px_1fr] xl:grid-rows-[auto_1fr] gap-4 xl:gap-6 ${mainContentTab === "summary" ? "" : "h-[calc(100vh-2rem)]"}`}>
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
                                                            name: e.target.value,
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
                                                                    e.target.value
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
                                                {activeMatchScore}%
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
                    <div className="flex items-center justify-between w-full gap-3">
                        <div className="w-3/4 flex tracking-tight">
                            {/* Candidate Story - concise summary with expander */}
                            <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-white/20 p-4 shadow-sm xl:sticky xl:top-2 w-full">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-semibold text-gray-900">
                                        Candidate Profile Story
                                    </h3>
                                    <button
                                        onClick={() => setStoryExpanded((v) => !v)}
                                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                    ></button>
                                </div>
                                <p className="text-sm text-gray-700 leading-relaxed">
                                    {longStory}
                                </p>
                            </div>
                        </div>
                        {/* Session navigation */}
                        {
                            <div className="w-1/4 flex items-center gap-2 justify-end">
                                <button
                                    className="px-3 py-1 rounded-lg bg-white/60 border border-white/40 text-gray-700 disabled:opacity-40"
                                    onClick={() =>
                                        setActiveSessionIndex((i) => Math.max(0, i - 1))
                                    }
                                    disabled={activeSessionIndex === 0}
                                    aria-label="Previous session"
                                >
                                    ◀
                                </button>
                                <div className="text-sm text-gray-700">
                                    Session {activeSessionIndex + 1} / {sessions.length}
                                </div>
                                <button
                                    className="px-3 py-1 rounded-lg bg-white/60 border border-white/40 text-gray-700 disabled:opacity-40"
                                    onClick={() =>
                                        setActiveSessionIndex((i) =>
                                            Math.min(sessions.length - 1, i + 1)
                                        )
                                    }
                                    disabled={activeSessionIndex === sessions.length - 1}
                                    aria-label="Next session"
                                >
                                    ▶
                                </button>
                            </div>
                        }
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
                                <span className="font-medium">Changes saved successfully!</span>
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
                                    onClick={() => setActiveTab("gaps")}
                                    className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ease-out ${
                                        activeTab === "gaps"
                                            ? "bg-blue-500 text-white shadow-md"
                                            : "text-gray-600 hover:text-gray-900 hover:bg-white/40"
                                    }`}
                                >
                                    Gaps
                                </button>
                            </div>
                        </div>

                        {/* Tab Content */}
                        <div
                            className="space-y-3 max-h-[calc(100vh-18rem)] overflow-y-auto border-t border-l border-r border-white/40 border-b-2 border-b-white/60 rounded-2xl bg-white/20 backdrop-blur-sm p-3 shadow-sm"
                        >
                            {activeTab === "benchmarks" && (
                                <div className="space-y-3 animate-in slide-in-from-right-2 duration-300">
                                    {workstyle && (
                                        <WorkstyleDashboard
                                            workstyle={workstyle}
                                            onVideoJump={onVideoJump}
                                            editMode={editMode}
                                            onUpdateWorkstyle={(updatedWorkstyle) => {
                                                // Update UI source of truth (sessions)
                                                setSessions((prev) => {
                                                    const next = [...prev];
                                                    if (next[activeSessionIndex]) {
                                                        next[activeSessionIndex] = {
                                                            ...next[activeSessionIndex],
                                                            workstyle: updatedWorkstyle,
                                                        };
                                                    }
                                                    return next;
                                                });
                                                // Keep payload for saving in telemetryData
                                                setTelemetryData((prev: any) => ({
                                                    ...prev,
                                                    workstyle: updatedWorkstyle,
                                                }));
                                            }}
                                        />
                                    )}
                                </div>
                            )}

                            {activeTab === "gaps" && (
                                <div className="space-y-3 animate-in slide-in-from-left-2 duration-300">
                                    {gaps && (
                                        <GapAnalysis
                                            gaps={gaps}
                                            onVideoJump={onVideoJump}
                                            editMode={editMode}
                                            onUpdateGaps={(updatedGaps) => {
                                                // Update UI source of truth (sessions)
                                                setSessions((prev) => {
                                                    const next = [...prev];
                                                    if (next[activeSessionIndex]) {
                                                        next[activeSessionIndex] = {
                                                            ...next[activeSessionIndex],
                                                            gaps: updatedGaps,
                                                        };
                                                    }
                                                    return next;
                                                });
                                                // Keep payload for saving in telemetryData
                                                setTelemetryData((prev: any) => ({
                                                    ...prev,
                                                    gaps: updatedGaps,
                                                }));
                                            }}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cell 3 - Video / Improvement (bottom-right) */}
                    <div className={`w-full xl:w-auto flex flex-col gap-2 ${mainContentTab === "summary" ? "" : "h-full"}`}>
                        <div className="flex items-center justify-between">
                            {mainContentTab === "improvement" ? (
                                <div className="flex gap-2 text-xs">
                                    {[
                                        { key: "match", label: "Match", color: "#3b82f6" },
                                        { key: "iter", label: "Iteration", color: "#a78bfa" },
                                        { key: "debug", label: "Debug", color: "#f97316" },
                                        { key: "ai", label: "AI", color: "#64748b" },
                                    ].map((s: any) => (
                                        <button
                                            key={s.key}
                                            onClick={() =>
                                                setSeriesVisible((prev) => ({
                                                    ...prev,
                                                    [s.key]: !prev[s.key as keyof typeof prev],
                                                }))
                                            }
                                            className="px-2 py-1 rounded-md border"
                                            style={{
                                                borderColor: s.color,
                                                color: seriesVisible[s.key as keyof typeof seriesVisible]
                                                    ? "#111827"
                                                    : "#9ca3af",
                                                backgroundColor: seriesVisible[s.key as keyof typeof seriesVisible]
                                                    ? `${s.color}20`
                                                    : "transparent",
                                            }}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div />
                            )}
                            <div className="bg-white/60 border border-white/40 rounded-lg p-1 text-xs">
                                <button
                                    onClick={() => setMainContentTab("summary")}
                                    className={`${
                                        mainContentTab === "summary" ? "bg-blue-500 text-white" : "text-gray-700"
                                    } px-2 py-1 rounded`}
                                >
                                    Summary
                                </button>
                                <button
                                    onClick={() => setMainContentTab("evidence")}
                                    className={`${
                                        mainContentTab === "evidence" ? "bg-blue-500 text-white" : "text-gray-700"
                                    } px-2 py-1 rounded ml-1`}
                                >
                                    Evidence
                                </button>
                                <button
                                    onClick={() => setMainContentTab("improvement")}
                                    className={`${
                                        mainContentTab === "improvement" ? "bg-blue-500 text-white" : "text-gray-700"
                                    } px-2 py-1 rounded ml-1`}
                                >
                                    Improvement
                                </button>
                            </div>
                        </div>
                        <div className={mainContentTab === "summary" ? "" : "flex-1"}>
                            {mainContentTab === "summary" ? (
                                <div className="w-full bg-white rounded-xl border border-gray-200 p-6">
                                    {summaryLoading ? (
                                        <div className="flex items-center justify-center py-12">
                                            <p className="text-gray-600">Loading background summary...</p>
                                        </div>
                                    ) : backgroundSummary ? (
                                        <TextSummary
                                            executiveSummary={backgroundSummary.executiveSummary}
                                            recommendation={backgroundSummary.recommendation}
                                            adaptability={{
                                                score: backgroundSummary.adaptability.score,
                                                text: backgroundSummary.adaptability.text,
                                                evidence: backgroundSummary.evidenceJson?.adaptability || [],
                                            }}
                                            creativity={{
                                                score: backgroundSummary.creativity.score,
                                                text: backgroundSummary.creativity.text,
                                                evidence: backgroundSummary.evidenceJson?.creativity || [],
                                            }}
                                            reasoning={{
                                                score: backgroundSummary.reasoning.score,
                                                text: backgroundSummary.reasoning.text,
                                                evidence: backgroundSummary.evidenceJson?.reasoning || [],
                                            }}
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center py-12">
                                            <p className="text-gray-600">No background summary available for this session.</p>
                                        </div>
                                    )}
                                </div>
                            ) : mainContentTab === "improvement" ? (
                                <div className="w-full h-full bg-white rounded-xl border border-gray-200 p-2 overflow-hidden">
                                    <ImprovementChart
                                        data={[...sessions]
                                            .map((s, i) => ({ s, i }))
                                            .sort((a, b) => {
                                                const at = new Date(a.s.createdAt || 0).getTime();
                                                const bt = new Date(b.s.createdAt || 0).getTime();
                                                return at - bt;
                                            })
                                            .map(({ s, i }, pos) => ({
                                                label: formatMonthYear(s.createdAt),
                                                index: pos,
                                                sessionIndex: i,
                                                match: typeof s.matchScore === "number" ? s.matchScore : null,
                                                iter: s.workstyle?.iterationSpeed?.value ?? null,
                                                debug:
                                                    s.workstyle?.debugLoops?.value != null
                                                        ? 100 - s.workstyle.debugLoops.value
                                                        : null,
                                                ai:
                                                    s.workstyle?.aiAssistUsage?.value != null
                                                        ? 100 - s.workstyle.aiAssistUsage.value
                                                        : null,
                                                matchTs: (s.evidence || []).find(
                                                    (e: any) => e.startTime !== null && e.startTime !== undefined
                                                )?.startTime,
                                                iterTs: (s.evidence || []).find(
                                                    (e: any) =>
                                                        (e.title || "").includes("Iteration") &&
                                                        e.startTime !== null &&
                                                        e.startTime !== undefined
                                                )?.startTime,
                                                debugTs: (s.evidence || []).find(
                                                    (e: any) => (e.title || "").includes("Debug") && e.startTime !== null && e.startTime !== undefined
                                                )?.startTime,
                                                aiTs: (s.evidence || []).find(
                                                    (e: any) => (e.title || "").includes("AI") && e.startTime !== null && e.startTime !== undefined
                                                )?.startTime,
                                            }))}
                                        activeIndex={activeSessionIndex}
                                        onSelect={(index: number, ts?: number) => {
                                            setActiveSessionIndex(index);
                                            if (typeof ts === "number") {
                                                onVideoJump(ts);
                                            }
                                        }}
                                        show={seriesVisible}
                                    />
                                </div>
                            ) : videoUrl ? (
                                <EvidenceReel
                                    jumpToTime={currentVideoTime}
                                    jumpKey={jumpKey}
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
