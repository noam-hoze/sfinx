import React from "react";
import { GapAnalysis as GapAnalysisType } from "../../../lib/interview/types";

interface GapAnalysisProps {
    gaps: GapAnalysisType;
}

const GapAnalysis: React.FC<GapAnalysisProps> = ({ gaps }) => {
    const getGapIcon = (severity: string) => {
        switch (severity) {
            case "Critical":
                return "🔴";
            case "Major":
                return "🟡";
            case "Minor":
                return "🟢";
            default:
                return "⚪";
        }
    };

    const getGapColor = (color: string) => {
        switch (color) {
            case "red":
                return "border-red-200 bg-red-50";
            case "yellow":
                return "border-yellow-200 bg-yellow-50";
            case "green":
                return "border-green-200 bg-green-50";
            default:
                return "border-gray-200 bg-gray-50";
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case "Critical":
                return "text-red-700";
            case "Major":
                return "text-yellow-700";
            case "Minor":
                return "text-green-700";
            default:
                return "text-gray-700";
        }
    };

    if (gaps.gaps.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="text-xl">✅</span>
                    Gaps
                </h3>
                <div className="text-center py-6 text-gray-500">
                    <span className="text-3xl mb-2 block">🎉</span>
                    <p>No significant gaps identified</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                Gaps
            </h3>

            <div className="space-y-3">
                {gaps.gaps.map((gap, index) => (
                    <div
                        key={index}
                        className={`p-3 rounded-lg border ${getGapColor(
                            gap.color
                        )}`}
                    >
                        <div className="flex items-start gap-3">
                            <span className="text-lg flex-shrink-0">
                                {getGapIcon(gap.severity)}
                            </span>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span
                                        className={`text-sm font-semibold ${getSeverityColor(
                                            gap.severity
                                        )}`}
                                    >
                                        {gap.severity}
                                    </span>
                                </div>

                                <p className="text-gray-700 text-sm leading-relaxed">
                                    {gap.description}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GapAnalysis;
