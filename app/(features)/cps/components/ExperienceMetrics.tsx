import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "shared/state/store";
import { setActiveEvidenceKey } from "shared/state/slices/cpsSlice";
import MetricRow from "./MetricRow";

interface BackgroundSummary {
    executiveSummary?: string;
    executiveSummaryOneLiner?: string | null;
    experienceCategories?: Record<string, {
        score: number;
        text: string;
        description?: string;
        evidenceLinks?: number[];
    }>;
}

interface EvidenceClip {
    id: string;
    startTime: number;
    category: 'ADAPTABILITY' | 'CREATIVITY' | 'REASONING' | string;
    title: string;
    description: string;
}

interface ExperienceMetricsProps {
    backgroundSummary: BackgroundSummary | null;
    evidenceClips?: EvidenceClip[];
    experienceCategories?: Array<{name: string; description: string; weight: number}>;
    onVideoJump: (timestamp: number) => void;
}

const ExperienceMetrics: React.FC<ExperienceMetricsProps> = ({
    backgroundSummary,
    evidenceClips = [],
    experienceCategories,
    onVideoJump,
}) => {
    const dispatch = useDispatch();
    const activeEvidenceKey = useSelector((state: RootState) => state.cps.activeEvidenceKey);
    
    if (!backgroundSummary || !backgroundSummary.experienceCategories) {
        return (
            <div className="text-sm text-gray-500">
                No experience categories defined for this job
            </div>
        );
    }

    // Filter experience evidence clips
    const backgroundClips = evidenceClips.filter(clip => 
        clip.category === 'EXPERIENCE_CATEGORY'
    );

    // Group clips by timestamp and combine descriptions
    const clipsByTimestamp = new Map<number, EvidenceClip[]>();
    backgroundClips.forEach(clip => {
        if (!clipsByTimestamp.has(clip.startTime)) {
            clipsByTimestamp.set(clip.startTime, []);
        }
        clipsByTimestamp.get(clip.startTime)!.push(clip);
    });

    // Create consolidated evidence links - one per unique timestamp with combined captions
    const consolidatedEvidenceLinks: Array<{ timestamp: number; evaluation?: string }> = [];
    
    clipsByTimestamp.forEach((clips, timestamp) => {
        // Combine descriptions with trait labels for all clips at this timestamp
        const combinedCaption = clips
            .map(clip => {
                const traitLabel = clip.category.charAt(0) + 
                    clip.category.slice(1).toLowerCase();
                return `${traitLabel}: ${clip.description}`;
            })
            .join('; ');
        
        consolidatedEvidenceLinks.push({
            timestamp,
            evaluation: combinedCaption,
        });
    });

    // Sort by timestamp
    consolidatedEvidenceLinks.sort((a, b) => a.timestamp - b.timestamp);

    return (
        <div>
            <div className="divide-y divide-gray-100">
                {Object.entries(backgroundSummary.experienceCategories).map(([categoryName, data]) => {
                    const categoryDef = experienceCategories?.find(c => c.name === categoryName);
                    return (
                        <MetricRow
                            key={categoryName}
                            label={categoryName}
                            description={data.description || categoryDef?.description || ""}
                            value={data.score ?? 0}
                            benchmarkLow={0}
                            benchmarkHigh={100}
                            evidenceLinks={data.evidenceLinks || []}
                            onVideoJump={onVideoJump}
                        />
                    );
                })}
            </div>

            {/* Consolidated Evidence Links */}
            {consolidatedEvidenceLinks.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-xs font-semibold text-gray-700 mb-2">
                        Evidence Clips
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {consolidatedEvidenceLinks.map((link, index) => {
                            const evidenceKey = `exp-${link.timestamp}-${index}`;
                            const isActive = activeEvidenceKey === evidenceKey;
                            
                            return (
                                <button
                                    key={evidenceKey}
                                    onClick={() => {
                                        dispatch(setActiveEvidenceKey(evidenceKey));
                                        onVideoJump(link.timestamp);
                                    }}
                                    className={`relative w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 !cursor-pointer shadow-sm ${
                                        isActive
                                            ? "bg-blue-500 text-white scale-110 shadow-md"
                                            : "bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:scale-105 hover:shadow"
                                    }`}
                                    style={{ cursor: 'pointer' }}
                                    title={`Jump to ${Math.floor(link.timestamp / 60)}:${(link.timestamp % 60)
                                        .toString()
                                        .padStart(2, "0")}`}
                                >
                                    {/* Play icon */}
                                    <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExperienceMetrics;
