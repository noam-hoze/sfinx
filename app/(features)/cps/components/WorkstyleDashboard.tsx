import React, { useState } from "react";
import { WorkstyleMetrics } from "../../../shared/contexts";
import MetricRow from "./MetricRow";
import CodeQualityModal from "./CodeQualityModal";

interface CodingSummary {
    codeQuality?: {
        score: number;
        text: string;
    };
    problemSolving?: {
        score: number;
        text: string;
    };
}

interface WorkstyleDashboardProps {
    workstyle: WorkstyleMetrics;
    codingSummary?: CodingSummary | null;
    onVideoJump: (timestamp: number) => void;
    sessionId?: string;
    isDemoMode?: boolean;
    editMode?: boolean;
    onUpdateWorkstyle?: (workstyle: WorkstyleMetrics) => void;
}

const WorkstyleDashboard: React.FC<WorkstyleDashboardProps> = ({
    workstyle,
    codingSummary,
    onVideoJump,
    sessionId,
    isDemoMode = false,
    editMode = false,
    onUpdateWorkstyle,
}) => {
    // Extract raw values
    const aiAssistValue = (workstyle.aiAssistUsage as any)?.avgAccountabilityScore ?? 100;
    
    // Modal state
    const [isQualityModalOpen, setIsQualityModalOpen] = useState(false);

    return (
        <>
            <div className="divide-y divide-gray-100">
                <MetricRow
                    label="Problem Solving"
                    description="Ability to identify and resolve coding challenges"
                    value={codingSummary?.problemSolving?.score ?? 0}
                    benchmarkLow={0}
                    benchmarkHigh={100}
                    evidenceLinks={workstyle.iterationSpeed?.evidenceLinks}
                    onVideoJump={onVideoJump}
                />
                <MetricRow
                    label="External Tools Usage"
                    description="Understanding and accountability for pasted code"
                    value={aiAssistValue}
                    benchmarkLow={0}
                    benchmarkHigh={100}
                    inverse={false}
                    evidenceLinks={workstyle.aiAssistUsage?.evidenceLinks}
                    onVideoJump={onVideoJump}
                />
                <div className="py-4 px-3 hover:bg-gray-50/30 transition-all duration-200 rounded-lg group">
                    <div className="flex items-start justify-between gap-6">
                        {/* Left: Label and Description */}
                        <div className="flex-shrink-0 w-[180px]">
                            <div className="text-sm font-semibold text-gray-800">
                                Code Quality
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 leading-relaxed break-words">
                                Adherence to best practices and maintainable code
                            </div>
                        </div>

                        {/* Right: Scale and Value */}
                        <div className="flex-1 flex items-center gap-4 min-w-0">
                            {/* Visual Scale */}
                            <div className="flex-1 min-w-[120px] max-w-[200px]">
                                <div className="relative h-2 rounded-full bg-gradient-to-r from-red-50 via-yellow-50 to-emerald-50 shadow-inner">
                                    {/* Candidate position marker */}
                                    <div
                                        className="absolute top-1/2 -translate-y-1/2 transition-all duration-300 ease-out"
                                        style={{
                                            left: `${codingSummary?.codeQuality?.score ?? 0}%`,
                                        }}
                                    >
                                        <div className={`w-4 h-4 rounded-full ${
                                            (codingSummary?.codeQuality?.score ?? 0) >= 75
                                                ? "bg-emerald-500"
                                                : (codingSummary?.codeQuality?.score ?? 0) >= 50
                                                ? "bg-amber-500"
                                                : "bg-red-500"
                                        } shadow-lg border-2 border-white transform -translate-x-1/2 group-hover:scale-110 transition-transform`} />
                                    </div>
                                </div>
                                {/* Status text */}
                                <div className="text-[10px] text-gray-400 mt-1 text-center font-medium">
                                    {(codingSummary?.codeQuality?.score ?? 0) >= 75
                                        ? "Excellent"
                                        : (codingSummary?.codeQuality?.score ?? 0) >= 50
                                        ? "Good"
                                        : "Needs Improvement"}
                                </div>
                            </div>

                            {/* Value */}
                            <div className="text-right flex-shrink-0 w-[70px]">
                                <span className="text-2xl font-bold text-gray-900 tabular-nums">
                                    {codingSummary?.codeQuality?.score ?? 0}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Analysis Button */}
                    {sessionId && (
                        <div className="mt-3 flex gap-2">
                            <button
                                onClick={() => setIsQualityModalOpen(true)}
                                className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1.5"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                View Analysis
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Code Quality Modal */}
            {sessionId && (
                <CodeQualityModal
                    isOpen={isQualityModalOpen}
                    onClose={() => setIsQualityModalOpen(false)}
                    sessionId={sessionId}
                    isDemoMode={isDemoMode}
                />
            )}
        </>
    );
};

export default WorkstyleDashboard;
