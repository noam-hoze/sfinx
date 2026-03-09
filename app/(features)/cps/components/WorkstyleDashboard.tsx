import React, { useState } from "react";
import { WorkstyleMetrics } from "../../../shared/contexts";
import MetricRow from "./MetricRow";
import CodeQualityModal from "./CodeQualityModal";
import {
    EvidenceJumpHandler,
    EXTERNAL_TOOLS_EVIDENCE_CATEGORY,
} from "../types/evidence";

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
    codingCategories?: Array<{name: string; description: string; weight: number}>;
    onVideoJump: EvidenceJumpHandler;
    sessionId?: string;
    editMode?: boolean;
    onUpdateWorkstyle?: (workstyle: WorkstyleMetrics) => void;
}

const WorkstyleDashboard: React.FC<WorkstyleDashboardProps> = ({
    workstyle,
    codingSummary,
    codingCategories,
    onVideoJump,
    sessionId,
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
                    label={EXTERNAL_TOOLS_EVIDENCE_CATEGORY}
                    description="Understanding and accountability for pasted code"
                    value={aiAssistValue}
                    benchmarkLow={0}
                    benchmarkHigh={100}
                    inverse={false}
                    evidenceLinks={workstyle.aiAssistUsage?.evidenceLinks}
                    evidenceCategory={EXTERNAL_TOOLS_EVIDENCE_CATEGORY}
                    onVideoJump={onVideoJump}
                />

                {/* Job-Specific Categories */}
                {codingCategories
                    ?.filter(categoryDef => categoryDef.weight > 0)
                    .map(categoryDef => {
                        // Match by base name (before any parentheses) to handle name mismatches
                        const baseName = categoryDef.name.split(' (')[0];
                        const matchingKey = codingSummary?.jobSpecificCategories ? 
                            Object.keys(codingSummary.jobSpecificCategories).find(key => 
                                key.startsWith(baseName) || categoryDef.name.startsWith(key)
                            ) || categoryDef.name
                            : categoryDef.name;
                        
                        const data = codingSummary?.jobSpecificCategories?.[matchingKey];
                        return (
                            <MetricRow
                                key={categoryDef.name}
                                label={categoryDef.name}
                                description={data?.description || categoryDef.description || "Job-specific coding evaluation"}
                                value={data?.score ?? 0}
                                benchmarkLow={0}
                                benchmarkHigh={100}
                                evidenceLinks={(data as any)?.evidenceLinks || []}
                                evidenceCategory={matchingKey}
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
                />
            )}
        </>
    );
};

export default WorkstyleDashboard;
