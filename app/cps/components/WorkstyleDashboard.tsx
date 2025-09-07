import React, { useState } from "react";
import { WorkstyleMetrics } from "../../../lib";
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
                return "Measures how quickly the candidate moves through development cycles.";
            case "debugLoops":
                return "Tracks the frequency and duration of debugging sessions.";
            case "refactorCleanups":
                return "Shows how often the candidate refactors and cleans up their code.";
            case "aiAssistUsage":
                return "Indicates the extent to which the candidate uses AI-powered assistance.";
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

    const metrics = [
        {
            key: "iterationSpeed" as keyof WorkstyleMetrics,
            label: "Iteration Speed",
            data: workstyle.iterationSpeed,
        },
        {
            key: "debugLoops" as keyof WorkstyleMetrics,
            label: "Debug Loops",
            data: workstyle.debugLoops,
        },
        {
            key: "refactorCleanups" as keyof WorkstyleMetrics,
            label: "Refactor & Cleanups",
            data: workstyle.refactorCleanups,
        },
        {
            key: "aiAssistUsage" as keyof WorkstyleMetrics,
            label: "AI Assist Usage",
            data: workstyle.aiAssistUsage,
        },
    ];

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                Workstyle
            </h3>

            <div className="space-y-3">
                {metrics.map((metric) => (
                    <div key={metric.key} className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-700">
                                    {metric.label}
                                </span>
                                <div className="group relative flex items-center">
                                    <Info size={14} className="text-gray-400" />
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
                                                parseInt(e.target.value) || 0;
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
                                    <span className="text-sm font-semibold text-gray-900">
                                        {metric.data.value}%
                                    </span>
                                )}
                                <span
                                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        metric.data.color === "blue"
                                            ? "bg-blue-100 text-blue-700"
                                            : metric.data.color === "yellow"
                                            ? "bg-yellow-100 text-yellow-700"
                                            : metric.data.color === "red"
                                            ? "bg-red-100 text-red-700"
                                            : "bg-gray-100 text-gray-700"
                                    }`}
                                >
                                    {metric.data.level}
                                </span>
                            </div>
                        </div>

                        <div className="relative">
                            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                    className={`h-full ${getColorClass(
                                        metric.data.color
                                    )} transition-all duration-500 ease-out`}
                                    style={{ width: `${metric.data.value}%` }}
                                ></div>
                            </div>
                        </div>

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
                                        {metric.data.evidenceLinks.map(
                                            (timestamp, index) => (
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
                                                                    ...metric
                                                                        .data
                                                                        .evidenceLinks,
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
                                                                metric.data.evidenceLinks.filter(
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
                                            )
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            metric.data.evidenceLinks &&
                            metric.data.evidenceLinks.length > 0 && (
                                <div className="flex gap-1 mt-2">
                                    {metric.data.evidenceLinks.map(
                                        (timestamp, index) => (
                                            <button
                                                key={index}
                                                onClick={() => {
                                                    setClickedTimestamp(
                                                        timestamp
                                                    );
                                                    onVideoJump(timestamp);
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
                            )
                        )}
                    </div>
                ))}
            </div>

            {/* Fairness Flag */}
            {workstyle.aiAssistUsage.isFairnessFlag && (
                <div className="mt-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-2 text-yellow-800">
                        <span className="text-lg">⚠️</span>
                        <span className="text-sm font-medium">
                            Fairness Flag Detected
                        </span>
                    </div>
                    <p className="text-xs text-yellow-700 mt-1">
                        High AI assistance usage may impact evaluation fairness
                    </p>
                </div>
            )}
        </div>
    );
};

export default WorkstyleDashboard;
