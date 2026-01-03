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
    jobSpecificCategories?: Record<string, {
        score: number;
        text: string;
    }>;
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
    const aiAssistValue = (workstyle.aiAssistUsage as any)?.avgAccountabilityScore;
    
    // Modal state
    const [isQualityModalOpen, setIsQualityModalOpen] = useState(false);

    return (
        <>
            <div className="divide-y divide-gray-100">
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

                {/* Job-Specific Categories */}
                {codingSummary?.jobSpecificCategories && Object.entries(codingSummary.jobSpecificCategories).map(([categoryName, categoryData]) => {
                    return (
                        <MetricRow
                            key={categoryName}
                            label={categoryName}
                            description={(categoryData as any).description || "Job-specific coding evaluation"}
                            value={categoryData.score}
                            benchmarkLow={0}
                            benchmarkHigh={100}
                            evidenceLinks={(categoryData as any).evidenceLinks || []}
                            onVideoJump={onVideoJump}
                        />
                    );
                })}

                {/* View Analysis Button */}
                {sessionId && (
                    <div className="py-4 px-3">
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
