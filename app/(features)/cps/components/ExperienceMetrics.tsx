import React from "react";
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

    // Create evidence link objects with combined captions
    const createEvidenceLinks = (categories: string[]) => {
        const links: Array<{ timestamp: number; evaluation?: string }> = [];
        
        clipsByTimestamp.forEach((clips, timestamp) => {
            // Filter clips that match any of the specified categories
            const relevantClips = clips.filter(clip => 
                categories.includes(clip.category)
            );
            
            if (relevantClips.length > 0) {
                // Combine descriptions with trait labels
                const combinedCaption = relevantClips
                    .map(clip => {
                        const traitLabel = clip.category.charAt(0) + 
                            clip.category.slice(1).toLowerCase();
                        return `${traitLabel}: ${clip.description}`;
                    })
                    .join('; ');
                
                links.push({
                    timestamp,
                    evaluation: combinedCaption,
                });
            }
        });
        
        return links;
    };

    // Create evidence links for each trait
    const adaptabilityLinks = createEvidenceLinks(['ADAPTABILITY']);
    const creativityLinks = createEvidenceLinks(['CREATIVITY']);
    const reasoningLinks = createEvidenceLinks(['REASONING']);

    return (
        <div className="divide-y divide-gray-100">
            <MetricRow
                label="Adaptability"
                description="Ability to adjust to new challenges and changing requirements"
                value={backgroundSummary.adaptability?.score ?? 0}
                benchmarkLow={0}
                benchmarkHigh={100}
                evidenceLinks={adaptabilityLinks}
                onVideoJump={onVideoJump}
            />
            <MetricRow
                label="Creativity"
                description="Capacity for innovative thinking and problem-solving"
                value={backgroundSummary.creativity?.score ?? 0}
                benchmarkLow={0}
                benchmarkHigh={100}
                evidenceLinks={creativityLinks}
                onVideoJump={onVideoJump}
            />
            <MetricRow
                label="Reasoning"
                description="Logical thinking and analytical decision-making skills"
                value={backgroundSummary.reasoning?.score ?? 0}
                benchmarkLow={0}
                benchmarkHigh={100}
                evidenceLinks={reasoningLinks}
                onVideoJump={onVideoJump}
            />
        </div>
    );
};

export default ExperienceMetrics;
