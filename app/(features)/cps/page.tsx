"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import EvidenceReel from "./components/EvidenceReel";
import CollapsibleSection from "./components/CollapsibleSection";
import ExperienceModal from "./components/ExperienceModal";
import CodingModal from "./components/CodingModal";
import WorkstyleDashboard from "./components/WorkstyleDashboard";
import GapAnalysis from "./components/GapAnalysis";
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
    const [backgroundSummary, setBackgroundSummary] = useState<any>(null);
    const [codingSummary, setCodingSummary] = useState<any>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [codingSummaryLoading, setCodingSummaryLoading] = useState(false);
    const [isNavigating, setIsNavigating] = useState(false);
    
    // Collapsible sections state
    const [scoreExpanded, setScoreExpanded] = useState(true);
    const [experienceExpanded, setExperienceExpanded] = useState(false);
    const [codingExpanded, setCodingExpanded] = useState(false);
    
    // Modal state
    const [experienceModalOpen, setExperienceModalOpen] = useState(false);
    const [codingModalOpen, setCodingModalOpen] = useState(false);

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
    }, [candidateId, applicationId]);

    const { candidate } = telemetryData || {};
    const activeSession = sessions[activeSessionIndex] || {};

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
    }, [activeSessionIndex, sessions, activeSession?.id]);

    // Fetch coding summary for active session
    useEffect(() => {
        const fetchCodingSummary = async () => {
            const sessionId = activeSession?.id;
            if (!sessionId || sessionId === "single") {
                setCodingSummary(null);
                return;
            }

            try {
                setCodingSummaryLoading(true);
                const response = await fetch(
                    `/api/interviews/session/${sessionId}/coding-summary`
                );

                if (response.ok) {
                    const data = await response.json();
                    setCodingSummary(data.summary);
                } else {
                    setCodingSummary(null);
                }
            } catch (error) {
                log.error("Error fetching coding summary:", error);
                setCodingSummary(null);
            } finally {
                setCodingSummaryLoading(false);
            }
        };

        fetchCodingSummary();
    }, [activeSessionIndex, sessions, activeSession?.id]);
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
        <div className="bg-gray-50 h-screen overflow-hidden flex flex-col">
            {/* Fixed Header */}
            <div className="bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 pt-4 pb-2">
                    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-3">
                        {/* Left Card: Name and Job Title */}
                        <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-white/20 p-4 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
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
                                <h1 className="text-lg font-medium text-gray-900">
                                    {candidate.name || ""}
                                </h1>
                                <p className="text-sm text-gray-600">
                                    {activeSession?.application?.job?.title || "Software Engineer"}
                                </p>
                                </div>
                            </div>
                        </div>
                        
                        {/* Right Card: Candidate Profile Story aligned with video */}
                        <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-white/20 p-4 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex-1">
                                    <h2 className="text-lg font-medium text-gray-900 mb-2">
                                        Candidate Profile Story
                                    </h2>
                                    <p className="text-sm text-gray-700 leading-relaxed">
                                        {longStory}
                                    </p>
                                </div>
                                
                                {/* Session Navigation */}
                                {sessions.length > 1 && (
                                    <div className="flex items-center gap-2 shrink-0">
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
                                            {activeSessionIndex + 1} / {sessions.length}
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
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden">
                <div className="max-w-7xl mx-auto h-full px-3 pb-4 pt-2">
                    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-3 h-full">
                        {/* Left Sidebar - Scrollable */}
                        <div className="space-y-3 overflow-y-auto">
                            {/* Score Section */}
                            <CollapsibleSection
                                title="Score"
                                score={activeMatchScore ?? undefined}
                                isExpanded={scoreExpanded}
                                onToggle={() => setScoreExpanded(!scoreExpanded)}
                            >
                                <p className="text-sm text-gray-600">
                                    Breakdown chart coming soon
                                </p>
                            </CollapsibleSection>
                            
                            {/* Experience Section */}
                            <CollapsibleSection
                                title="Experience"
                                score={80}
                                isExpanded={experienceExpanded}
                                onToggle={() => setExperienceExpanded(!experienceExpanded)}
                            >
                                {summaryLoading ? (
                                    <p className="text-sm text-gray-600">Loading...</p>
                                ) : backgroundSummary ? (
                                    <div className="space-y-3">
                                        <p className="text-sm text-gray-700 leading-relaxed">
                                            {backgroundSummary.executiveSummary}
                                        </p>
                                <button
                                            onClick={() => setExperienceModalOpen(true)}
                                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                        >
                                            Read more
                                </button>
                            </div>
                                ) : (
                                    <p className="text-sm text-gray-600">
                                        No experience summary available
                                    </p>
                                )}
                            </CollapsibleSection>
                            
                            {/* Coding Section */}
                            <CollapsibleSection
                                title="Coding"
                                score={50}
                                isExpanded={codingExpanded}
                                onToggle={() => setCodingExpanded(!codingExpanded)}
                            >
                                {workstyle && (
                                    <WorkstyleDashboard
                                        workstyle={workstyle}
                                        onVideoJump={onVideoJump}
                                    />
                                )}
                                {gaps && (
                                    <div className="mt-3">
                                        <GapAnalysis
                                            gaps={gaps}
                                            onVideoJump={onVideoJump}
                                        />
                                    </div>
                                )}
                                {codingSummary && (
                                    <button
                                        onClick={() => setCodingModalOpen(true)}
                                        className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
                                    >
                                        Read more
                                    </button>
                                )}
                            </CollapsibleSection>
                        </div>
                        
                        {/* Right Panel - Video */}
                        <div className="w-full h-full">
                            {videoUrl ? (
                                <EvidenceReel
                                    jumpToTime={currentVideoTime}
                                    jumpKey={jumpKey}
                                    videoUrl={videoUrl}
                                    duration={duration}
                                    chapters={chapters}
                                    paused={false}
                                />
                            ) : (
                                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                    <p className="text-gray-600">No video available</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                                                </div>
            
            {/* Modals */}
            {backgroundSummary && (
                <ExperienceModal
                    isOpen={experienceModalOpen}
                    onClose={() => setExperienceModalOpen(false)}
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
            )}
            
            {codingSummary && (
                <CodingModal
                    isOpen={codingModalOpen}
                    onClose={() => setCodingModalOpen(false)}
                                                    executiveSummary={codingSummary.executiveSummary}
                                                    recommendation={codingSummary.recommendation}
                                                    codeQuality={{
                                                        score: codingSummary.codeQuality.score,
                                                        text: codingSummary.codeQuality.text,
                                                    }}
                                                    problemSolving={{
                                                        score: codingSummary.problemSolving.score,
                                                        text: codingSummary.problemSolving.text,
                                                    }}
                                                    independence={{
                                                        score: codingSummary.independence.score,
                                                        text: codingSummary.independence.text,
                                                    }}
                                                />
            )}
            
            {/* TODO: Add link to improvement graph in future */}
            {/* ImprovementChart code preserved for future use */}
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
