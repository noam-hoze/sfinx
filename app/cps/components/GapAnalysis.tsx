import React, { useState } from "react";
import { GapAnalysis as GapAnalysisType } from "../../../lib/interview/types";

interface GapAnalysisProps {
    gaps: GapAnalysisType;
    onVideoJump: (timestamp: number) => void;
}

const GapAnalysis: React.FC<GapAnalysisProps> = ({ gaps, onVideoJump }) => {
    const [clickedTimestamp, setClickedTimestamp] = useState<number | null>(
        null
    );
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

                                {/* Video Evidence Links */}
                                {gap.evidenceLinks &&
                                    gap.evidenceLinks.length > 0 && (
                                        <div className="flex gap-1 mt-2">
                                            {gap.evidenceLinks.map(
                                                (timestamp, index) => (
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
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GapAnalysis;
