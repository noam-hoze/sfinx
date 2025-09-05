import React from "react";
import { WorkstyleMetrics } from "../../../lib/interview/types";

interface WorkstyleDashboardProps {
    workstyle: WorkstyleMetrics;
}

const WorkstyleDashboard: React.FC<WorkstyleDashboardProps> = ({
    workstyle,
}) => {
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
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-900">
                                    {metric.data.value}%
                                </span>
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

            {!workstyle.aiAssistUsage.isFairnessFlag && (
                <div className="mt-6 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-800">
                        <span className="text-lg">✅</span>
                        <span className="text-sm font-medium">
                            Clean Session
                        </span>
                    </div>
                    <p className="text-xs text-green-700 mt-1">
                        No fairness concerns detected
                    </p>
                </div>
            )}
        </div>
    );
};

export default WorkstyleDashboard;
