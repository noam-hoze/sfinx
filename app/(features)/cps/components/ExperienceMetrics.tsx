import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "shared/state/store";
import { setActiveEvidenceKey } from "shared/state/slices/cpsSlice";
import MetricRow from "./MetricRow";

interface BackgroundSummary {
    executiveSummary?: string;
    executiveSummaryOneLiner?: string | null;
    adaptability?: {
        score: number;
        text: string;
        oneLiner?: string | null;
    };
    creativity?: {
        score: number;
        text: string;
        oneLiner?: string | null;
    };
    reasoning?: {
        score: number;
        text: string;
        oneLiner?: string | null;
    };
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
    onVideoJump: (timestamp: number) => void;
}

const ExperienceMetrics: React.FC<ExperienceMetricsProps> = ({
    backgroundSummary,
    evidenceClips = [],
    onVideoJump,
}) => {
    const dispatch = useDispatch();
    const activeEvidenceKey = useSelector((state: RootState) => state.cps.activeEvidenceKey);
    
    if (!backgroundSummary) {
        return (
            <div className="text-sm text-gray-500">
                No experience data available
            </div>
        );
    }

    // Filter background evidence clips (exclude coding categories)
    const backgroundClips = evidenceClips.filter(clip => 
        clip.category === 'ADAPTABILITY' || 
        clip.category === 'CREATIVITY' || 
        clip.category === 'REASONING'
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
                <MetricRow
                    label="Adaptability"
                    description="Ability to adjust to new challenges and changing requirements"
                    value={backgroundSummary.adaptability?.score ?? 0}
                    benchmarkLow={0}
                    benchmarkHigh={100}
                    onVideoJump={onVideoJump}
                />
                <MetricRow
                    label="Creativity"
                    description="Capacity for innovative thinking and problem-solving"
                    value={backgroundSummary.creativity?.score ?? 0}
                    benchmarkLow={0}
                    benchmarkHigh={100}
                    onVideoJump={onVideoJump}
                />
                <MetricRow
                    label="Reasoning"
                    description="Logical thinking and analytical decision-making skills"
                    value={backgroundSummary.reasoning?.score ?? 0}
                    benchmarkLow={0}
                    benchmarkHigh={100}
                    onVideoJump={onVideoJump}
                />
            </div>

            {/* Consolidated Evidence Links */}
            {consolidatedEvidenceLinks.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-xs font-semibold text-gray-700 mb-2">
                        Evidence Clips
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {consolidatedEvidenceLinks.map((link, index) => {
                            const evidenceKey = `${link.timestamp}-${link.evaluation || 'none'}`;
                            const isActive = activeEvidenceKey === evidenceKey;
                            
                            return (
                                <button
                                    key={index}
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
