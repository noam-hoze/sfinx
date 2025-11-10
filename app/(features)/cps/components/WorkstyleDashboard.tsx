import React, { useState } from "react";
import { WorkstyleMetrics } from "../../../shared/contexts";
import { Info } from "lucide-react";

interface WorkstyleDashboardProps {
    workstyle: WorkstyleMetrics;
    onVideoJump: (timestamp: number) => void;
    editMode?: boolean;
    onUpdateWorkstyle?: (workstyle: WorkstyleMetrics) => void;
}

const WorkstyleDashboard: React.FC<WorkstyleDashboardProps> = ({
    workstyle,
    onVideoJump,
    editMode = false,
    onUpdateWorkstyle,
}) => {
    const [clickedTimestamp, setClickedTimestamp] = useState<number | null>(
        null
    );

    const getTooltipText = (key: string) => {
        switch (key) {
            case "iterationSpeed":
                return "Velocity of meaningful change cycles (edit → run/test → result). Measured from saves/runs and test outcomes—time‑to‑first‑success, median/p95 cycle time, and iterations per 10 minutes. Faster, consistent cycles score higher.";
            case "debugLoops":
                return "Tracks sequences from failing to passing states (problem isolation → fix). Uses error/test status transitions and repeated attempts; fewer, well‑structured loops with quick isolation and a high fix rate indicate effective debugging.";
            case "aiAssistUsage":
                return "Tracks code pasted from external sources during the coding session. Each paste triggers a multi-turn conversation where the candidate explains their understanding. Scores reflect how well they understand the pasted code, with evidence links to the exact moments in the video.";
            default:
                return "";
        }
    };

    const getColorClass = (color: string) => {
        switch (color) {
            case "blue":
                return "bg-blue-500";
            case "yellow":
                return "bg-yellow-500";
            case "red":
                return "bg-red-500";
            case "white":
                return "bg-gray-300";
            default:
                return "bg-gray-400";
        }
    };

    // Relative position of candidate value with TPE centered at 50%
    const getRelativePositionPercent = (
        value?: number,
        tpe?: number
    ): string => {
        if (typeof value !== "number") return "50%";
        if (typeof tpe !== "number") return `${value}%`;
        const pos = 50 + (value - tpe) * 0.5; // map [0..100] with TPE to center
        const clamped = Math.max(0, Math.min(100, pos));
        return `${clamped}%`;
    };

    // Color for the candidate dot relative to TPE
    const getDotColorClass = (
        key: string,
        value?: number,
        tpe?: number
    ): string => {
        // All dots are neutral gray now
        return "bg-gray-400";
    };

    const getBaseLineClass = (key: string): string => {
        if (key === "aiAssistUsage") {
            return "h-[3px] bg-gray-200 rounded";
        }
        // Green to red gradient for performance scale
        return "h-[3px] bg-gradient-to-r from-green-400 to-red-400 rounded";
    };

    const getDeltaTextColorClass = (
        key: string,
        value?: number,
        tpe?: number
    ): string => {
        if (typeof value !== "number" || typeof tpe !== "number")
            return "text-gray-500";
        const lowerIsBetter =
            key === "iterationSpeed" ||
            key === "debugLoops" ||
            key === "aiAssistUsage";
        const delta = value - tpe;
        if (lowerIsBetter) {
            return delta <= 0 ? "text-green-600" : "text-red-600";
        }
        return delta >= 0 ? "text-green-600" : "text-red-600";
    };

    const metrics = [
        {
            key: "iterationSpeed" as keyof WorkstyleMetrics,
            label: "# Iterations",
            data: workstyle.iterationSpeed,
        },
        {
            key: "debugLoops" as keyof WorkstyleMetrics,
            label: "Debug Loops",
            data: workstyle.debugLoops,
        },
        {
            key: "aiAssistUsage" as keyof WorkstyleMetrics,
            label: "External Tool Usage",
            data: workstyle.aiAssistUsage,
        },
    ];

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                Workstyle
            </h3>

            <div className="divide-y divide-gray-100">
                {metrics.map((metric) => {
                    const data = (metric as any).data;
                    if (data == null)
                        return null;
                    
                    // Special rendering for Iterations
                    if (metric.key === "iterationSpeed") {
                        return (
                            <div
                                key={metric.key}
                                className="py-3 first:pt-0 last:pb-0 px-2 rounded-md hover:bg-gray-50 transition"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-700">
                                            {metric.label}
                                        </span>
                                        <div className="group relative flex items-center">
                                            <Info
                                                size={14}
                                                className="text-gray-400"
                                            />
                                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 bg-white text-black text-xs rounded py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none border border-gray-200 shadow-lg z-10 whitespace-normal">
                                                {getTooltipText(metric.key)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-2xl font-bold text-gray-900">
                                            {metric.data.value}
                                        </span>
                                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                                            metric.data.level === "High"
                                                ? "bg-blue-100 text-blue-700"
                                                : metric.data.level === "Moderate"
                                                ? "bg-yellow-100 text-yellow-700"
                                                : "bg-red-100 text-red-700"
                                        }`}>
                                            {metric.data.level}
                                        </span>
                                    </div>
                                    <span className="text-xs text-gray-500">
                                        {metric.data.value === 1 ? "iteration" : "iterations"}
                                    </span>
                                    {!editMode && (metric.data.evidenceLinks ?? []).length > 0 && (
                                        <div className="flex items-center gap-1 flex-wrap">
                                            <span className="text-xs text-gray-500 mr-1">Evidence:</span>
                                            {(metric.data.evidenceLinks ?? []).map(
                                                (timestamp: number, index: number) => (
                                                    <button
                                                        key={index}
                                                        onClick={() => {
                                                            setClickedTimestamp(timestamp);
                                                            onVideoJump(timestamp);
                                                        }}
                                                        className={`w-6 h-6 flex items-center justify-center text-xs font-medium rounded transition-all duration-200 ${
                                                            clickedTimestamp === timestamp
                                                                ? "text-blue-600 bg-blue-50 ring-2 ring-blue-200"
                                                                : "text-gray-600 bg-gray-100 hover:text-blue-600 hover:bg-blue-50"
                                                        }`}
                                                        title={`Jump to ${Math.floor(
                                                            timestamp / 60
                                                        )}:${(timestamp % 60)
                                                            .toString()
                                                            .padStart(2, "0")}`}
                                                    >
                                                        {index + 1}
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    }

                    if (metric.key === "debugLoops") {
                        return (
                            <div
                                key={metric.key}
                                className="py-3 first:pt-0 last:pb-0 px-2 rounded-md hover:bg-gray-50 transition"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-700">
                                            {metric.label}
                                        </span>
                                        <div className="group relative flex items-center">
                                            <Info
                                                size={14}
                                                className="text-gray-400"
                                            />
                                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 bg-white text-black text-xs rounded py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none border border-gray-200 shadow-lg z-10 whitespace-normal">
                                                {getTooltipText(metric.key)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-2xl font-bold text-gray-900">
                                            {metric.data.value || 0}
                                        </span>
                                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                                            metric.data.level === "Fast"
                                                ? "bg-blue-100 text-blue-700"
                                                : metric.data.level === "Moderate"
                                                ? "bg-yellow-100 text-yellow-700"
                                                : "bg-red-100 text-red-700"
                                        }`}>
                                            {metric.data.level}
                                        </span>
                                    </div>
                                    <span className="text-xs text-gray-500">
                                        Total Loops Resolved
                                    </span>
                                    {(metric.data as any).avgDepth !== undefined && (
                                        <>
                                            <span className="text-xs text-gray-500">
                                                Average Depth: {(metric.data as any).avgDepth} errors per loop
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                Longest Loop: {(metric.data as any).longestLoop} consecutive errors
                                            </span>
                                            {(metric.data as any).unresolved > 0 && (
                                                <span className="text-xs text-gray-500">
                                                    Unresolved: {(metric.data as any).unresolved}
                                                </span>
                                            )}
                                        </>
                                    )}
                                    {!editMode && (metric.data.evidenceLinks ?? []).length > 0 && (
                                        <div className="flex items-center gap-1 flex-wrap">
                                            <span className="text-xs text-gray-500 mr-1">Evidence:</span>
                                            {(metric.data.evidenceLinks ?? []).map(
                                                (timestamp: number, index: number) => (
                                                    <button
                                                        key={index}
                                                        onClick={() => {
                                                            setClickedTimestamp(timestamp);
                                                            onVideoJump(timestamp);
                                                        }}
                                                        className={`w-6 h-6 flex items-center justify-center text-xs font-medium rounded transition-all duration-200 ${
                                                            clickedTimestamp === timestamp
                                                                ? "text-blue-600 bg-blue-50 ring-2 ring-blue-200"
                                                                : "text-gray-600 bg-gray-100 hover:text-blue-600 hover:bg-blue-50"
                                                        }`}
                                                        title={`Jump to ${Math.floor(
                                                            timestamp / 60
                                                        )}:${(timestamp % 60)
                                                            .toString()
                                                            .padStart(2, "0")}`}
                                                    >
                                                        {index + 1}
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    }

                    if (metric.key === "aiAssistUsage") {
                        return (
                            <div
                                key={metric.key}
                                className="py-3 first:pt-0 last:pb-0 px-2 rounded-md hover:bg-gray-50 transition"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-700">
                                            {metric.label}
                                        </span>
                                        <div className="group relative flex items-center">
                                            <Info
                                                size={14}
                                                className="text-gray-400"
                                            />
                                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 bg-white text-black text-xs rounded py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none border border-gray-200 shadow-lg z-10 whitespace-normal">
                                                {getTooltipText(metric.key)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-2xl font-bold text-gray-900">
                                            {metric.data.value || 0}
                                        </span>
                                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                                            metric.data.level === "High"
                                                ? "bg-blue-100 text-blue-700"
                                                : metric.data.level === "Moderate"
                                                ? "bg-yellow-100 text-yellow-700"
                                                : "bg-red-100 text-red-700"
                                        }`}>
                                            {metric.data.level}
                                        </span>
                                    </div>
                                    <span className="text-xs text-gray-500">
                                        {metric.data.value === 1 ? "Paste Detected" : "Pastes Detected"}
                                    </span>
                                    {((metric.data as any).fullCount !== undefined || 
                                      (metric.data as any).partialCount !== undefined || 
                                      (metric.data as any).noneCount !== undefined) && (
                                        <>
                                            <span className="text-xs text-gray-500 font-medium mt-1">
                                                Understanding Breakdown:
                                            </span>
                                            <div className="flex flex-col gap-1 text-xs text-gray-500">
                                                <span>• Full: {(metric.data as any).fullCount || 0}</span>
                                                <span>• Partial: {(metric.data as any).partialCount || 0}</span>
                                                <span>• None: {(metric.data as any).noneCount || 0}</span>
                                            </div>
                                            {(metric.data as any).avgAccountabilityScore !== undefined && (
                                                <span className="text-xs text-gray-500">
                                                    Avg. Accountability Score: {(metric.data as any).avgAccountabilityScore}%
                                                </span>
                                            )}
                                        </>
                                    )}
                                    {!editMode && (metric.data.evidenceLinks ?? []).length > 0 && (
                                        <div className="flex items-center gap-1 flex-wrap">
                                            <span className="text-xs text-gray-500 mr-1">Evidence:</span>
                                            {(metric.data.evidenceLinks ?? []).map(
                                                (timestamp: number, index: number) => (
                                                    <button
                                                        key={index}
                                                        onClick={() => {
                                                            setClickedTimestamp(timestamp);
                                                            onVideoJump(timestamp);
                                                        }}
                                                        className={`w-6 h-6 flex items-center justify-center text-xs font-medium rounded transition-all duration-200 ${
                                                            clickedTimestamp === timestamp
                                                                ? "text-blue-600 bg-blue-50 ring-2 ring-blue-200"
                                                                : "text-gray-600 bg-gray-100 hover:text-blue-600 hover:bg-blue-50"
                                                        }`}
                                                        title={`Jump to ${Math.floor(
                                                            timestamp / 60
                                                        )}:${(timestamp % 60)
                                                            .toString()
                                                            .padStart(2, "0")}`}
                                                    >
                                                        {index + 1}
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    }
                    
                    // Standard rendering for other metrics
                    return (
                        <div
                            key={metric.key}
                            className="py-3 first:pt-0 last:pb-0 px-2 rounded-md hover:bg-gray-50 transition"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-700">
                                        {metric.label}
                                    </span>
                                    <div className="group relative flex items-center">
                                        <Info
                                            size={14}
                                            className="text-gray-400"
                                        />
                                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 bg-white text-black text-xs rounded py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none border border-gray-200 shadow-lg z-10 whitespace-normal">
                                            {getTooltipText(metric.key)}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {editMode ? (
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={metric.data.value}
                                            onChange={(e) => {
                                                const newValue =
                                                    parseInt(e.target.value) ||
                                                    0;
                                                const updatedWorkstyle = {
                                                    ...workstyle,
                                                    [metric.key]: {
                                                        ...metric.data,
                                                        value: newValue,
                                                    },
                                                };
                                                onUpdateWorkstyle?.(
                                                    updatedWorkstyle
                                                );
                                            }}
                                            className="text-sm font-semibold text-gray-900 bg-white/50 border border-gray-300 rounded px-2 py-1 w-16 text-center"
                                        />
                                    ) : (
                                        <div className="flex items-center gap-1">
                                            {(
                                                metric.data.evidenceLinks ?? []
                                            ).map(
                                                (
                                                    timestamp: number,
                                                    index: number
                                                ) => (
                                                    <button
                                                        key={index}
                                                        onClick={() => {
                                                            setClickedTimestamp(
                                                                timestamp
                                                            );
                                                            onVideoJump(
                                                                timestamp
                                                            );
                                                        }}
                                                        className={`w-6 h-6 flex items-center justify-center text-xs font-medium rounded transition-all duration-200 ${
                                                            clickedTimestamp ===
                                                            timestamp
                                                                ? "text-blue-600 bg-blue-50"
                                                                : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                                        }`}
                                                        title={`Jump to ${Math.floor(
                                                            timestamp / 60
                                                        )}:${(timestamp % 60)
                                                            .toString()
                                                            .padStart(2, "0")}`}
                                                    >
                                                        {index + 1}
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="relative h-6 mt-1">
                                {/* Base line */}
                                <div
                                    className={`absolute left-0 right-0 top-1/2 -translate-y-1/2 ${getBaseLineClass(
                                        metric.key as string
                                    )}`}
                                />
                                {/* Center TPE tick */}
                                <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[3px] bg-gray-700 rounded-sm shadow-[0_0_0_2px_rgba(255,255,255,0.9)]" />
                                <div className="absolute left-1/2 -translate-x-1/2 top-[calc(50%+10px)] text-[10px] text-gray-500">
                                    TPE
                                </div>
                                {/* Candidate dot */}
                                <div
                                    className={`group absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border border-white shadow ${getDotColorClass(
                                        metric.key as string,
                                        metric.data.value,
                                        (metric.data as any).tpe
                                    )}`}
                                    style={{
                                        left: getRelativePositionPercent(
                                            metric.data.value,
                                            (metric.data as any).tpe
                                        ),
                                    }}
                                >
                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs bg-white text-gray-700 border border-gray-200 rounded px-2 py-1 opacity-0 pointer-events-none group-hover:opacity-100">
                                        {metric.data.value}
                                        {typeof (metric.data as any).tpe ===
                                            "number" &&
                                            ` vs TPE ${
                                                (metric.data as any).tpe
                                            }`}
                                    </div>
                                </div>
                            </div>
                            {metric.key === "iterationSpeed" && (
                                <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                                    <span>Efficient</span>
                                    <span>Inefficient</span>
                                </div>
                            )}
                            {metric.key === "debugLoops" && (
                                <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                                    <span>Efficient</span>
                                    <span>Inefficient</span>
                                </div>
                            )}
                            {metric.key === "refactorCleanups" && (
                                <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                                    <span>Efficient</span>
                                    <span>Inefficient</span>
                                </div>
                            )}
                            {metric.key === "aiAssistUsage" && (
                                <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                                    <span>Hands-on</span>
                                    <span>AI Assist</span>
                                </div>
                            )}

                            {/* Video Evidence Links */}
                            {editMode ? (
                                <div className="mt-2 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500">
                                            Evidence Links:
                                        </span>
                                        <button
                                            onClick={() => {
                                                const updatedWorkstyle = {
                                                    ...workstyle,
                                                    [metric.key]: {
                                                        ...metric.data,
                                                        evidenceLinks: [
                                                            ...(metric.data
                                                                .evidenceLinks ||
                                                                []),
                                                            0,
                                                        ],
                                                    },
                                                };
                                                onUpdateWorkstyle?.(
                                                    updatedWorkstyle
                                                );
                                            }}
                                            className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                                        >
                                            + Add
                                        </button>
                                    </div>
                                    {(metric.data.evidenceLinks || []).length >
                                        0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {(
                                                metric.data.evidenceLinks ?? []
                                            ).map((timestamp, index) => (
                                                <div
                                                    key={index}
                                                    className="flex items-center gap-1"
                                                >
                                                    <input
                                                        type="number"
                                                        value={timestamp}
                                                        onChange={(e) => {
                                                            const newTimestamp =
                                                                parseInt(
                                                                    e.target
                                                                        .value
                                                                ) || 0;
                                                            const updatedLinks =
                                                                [
                                                                    ...(metric
                                                                        .data
                                                                        .evidenceLinks ??
                                                                        []),
                                                                ];
                                                            updatedLinks[
                                                                index
                                                            ] = newTimestamp;
                                                            const updatedWorkstyle =
                                                                {
                                                                    ...workstyle,
                                                                    [metric.key]:
                                                                        {
                                                                            ...metric.data,
                                                                            evidenceLinks:
                                                                                updatedLinks,
                                                                        },
                                                                };
                                                            onUpdateWorkstyle?.(
                                                                updatedWorkstyle
                                                            );
                                                        }}
                                                        className="w-16 text-xs border border-gray-300 rounded px-1 py-1 text-center"
                                                        placeholder="0"
                                                        min="0"
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            const updatedLinks =
                                                                (
                                                                    metric.data
                                                                        .evidenceLinks ??
                                                                    []
                                                                ).filter(
                                                                    (_, i) =>
                                                                        i !==
                                                                        index
                                                                );
                                                            const updatedWorkstyle =
                                                                {
                                                                    ...workstyle,
                                                                    [metric.key]:
                                                                        {
                                                                            ...metric.data,
                                                                            evidenceLinks:
                                                                                updatedLinks,
                                                                        },
                                                                };
                                                            onUpdateWorkstyle?.(
                                                                updatedWorkstyle
                                                            );
                                                        }}
                                                        className="text-xs text-red-500 hover:text-red-700"
                                                        title="Remove link"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default WorkstyleDashboard;
