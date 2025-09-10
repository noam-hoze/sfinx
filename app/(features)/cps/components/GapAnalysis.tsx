import React, { useState } from "react";
import { GapAnalysis as GapAnalysisType } from "../../../shared/contexts";

interface GapAnalysisProps {
    gaps: GapAnalysisType;
    onVideoJump: (timestamp: number) => void;
    editMode?: boolean;
    onUpdateGaps?: (gaps: GapAnalysisType) => void;
}

const GapAnalysis: React.FC<GapAnalysisProps> = ({
    gaps,
    onVideoJump,
    editMode = false,
    onUpdateGaps,
}) => {
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

                                {editMode ? (
                                    <textarea
                                        value={gap.description}
                                        onChange={(e) => {
                                            const updatedGaps = gaps.gaps.map(
                                                (g, index) =>
                                                    index ===
                                                    gaps.gaps.indexOf(gap)
                                                        ? {
                                                              ...g,
                                                              description:
                                                                  e.target
                                                                      .value,
                                                          }
                                                        : g
                                            );
                                            onUpdateGaps?.({
                                                ...gaps,
                                                gaps: updatedGaps,
                                            });
                                        }}
                                        className="text-gray-700 text-sm leading-relaxed bg-white/50 border border-gray-300 rounded px-2 py-1 w-full resize-none"
                                        rows={2}
                                        placeholder="Gap description"
                                    />
                                ) : (
                                    <p className="text-gray-700 text-sm leading-relaxed">
                                        {gap.description}
                                    </p>
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
                                                    const updatedGaps =
                                                        gaps.gaps.map(
                                                            (g, index) =>
                                                                index ===
                                                                gaps.gaps.indexOf(
                                                                    gap
                                                                )
                                                                    ? {
                                                                          ...g,
                                                                          evidenceLinks:
                                                                              [
                                                                                  ...(g.evidenceLinks ||
                                                                                      []),
                                                                                  0,
                                                                              ],
                                                                      }
                                                                    : g
                                                        );
                                                    onUpdateGaps?.({
                                                        ...gaps,
                                                        gaps: updatedGaps,
                                                    });
                                                }}
                                                className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                                            >
                                                + Add
                                            </button>
                                        </div>
                                        {(gap.evidenceLinks || []).length >
                                            0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {gap.evidenceLinks.map(
                                                    (timestamp, index) => (
                                                        <div
                                                            key={index}
                                                            className="flex items-center gap-1"
                                                        >
                                                            <input
                                                                type="number"
                                                                value={
                                                                    timestamp
                                                                }
                                                                onChange={(
                                                                    e
                                                                ) => {
                                                                    const newTimestamp =
                                                                        parseInt(
                                                                            e
                                                                                .target
                                                                                .value
                                                                        ) || 0;
                                                                    const updatedGaps =
                                                                        gaps.gaps.map(
                                                                            (
                                                                                g,
                                                                                gapIndex
                                                                            ) =>
                                                                                gapIndex ===
                                                                                gaps.gaps.indexOf(
                                                                                    gap
                                                                                )
                                                                                    ? {
                                                                                          ...g,
                                                                                          evidenceLinks:
                                                                                              g.evidenceLinks.map(
                                                                                                  (
                                                                                                      t,
                                                                                                      linkIndex
                                                                                                  ) =>
                                                                                                      linkIndex ===
                                                                                                      index
                                                                                                          ? newTimestamp
                                                                                                          : t
                                                                                              ),
                                                                                      }
                                                                                    : g
                                                                        );
                                                                    onUpdateGaps?.(
                                                                        {
                                                                            ...gaps,
                                                                            gaps: updatedGaps,
                                                                        }
                                                                    );
                                                                }}
                                                                className="w-16 text-xs border border-gray-300 rounded px-1 py-1 text-center"
                                                                placeholder="0"
                                                                min="0"
                                                            />
                                                            <button
                                                                onClick={() => {
                                                                    const updatedGaps =
                                                                        gaps.gaps.map(
                                                                            (
                                                                                g,
                                                                                gapIndex
                                                                            ) =>
                                                                                gapIndex ===
                                                                                gaps.gaps.indexOf(
                                                                                    gap
                                                                                )
                                                                                    ? {
                                                                                          ...g,
                                                                                          evidenceLinks:
                                                                                              g.evidenceLinks.filter(
                                                                                                  (
                                                                                                      _,
                                                                                                      linkIndex
                                                                                                  ) =>
                                                                                                      linkIndex !==
                                                                                                      index
                                                                                              ),
                                                                                      }
                                                                                    : g
                                                                        );
                                                                    onUpdateGaps?.(
                                                                        {
                                                                            ...gaps,
                                                                            gaps: updatedGaps,
                                                                        }
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
                                    gap.evidenceLinks &&
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
                                    )
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
