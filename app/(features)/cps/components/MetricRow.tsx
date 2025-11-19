import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "shared/state/store";
import { setActiveEvidenceTimestamp } from "shared/state/slices/cpsSlice";

interface EvidenceLink {
    timestamp: number;
    evaluation?: string;
}

interface MetricRowProps {
    label: string;
    description: string;
    value: number | null;
    unit?: string;
    benchmarkLow?: number;
    benchmarkHigh?: number;
    inverse?: boolean; // For metrics where lower is better (iteration speed)
    evidenceLinks?: number[] | EvidenceLink[]; // Video timestamps for evidence (with optional evaluation status)
    onVideoJump?: (timestamp: number) => void;
}

const MetricRow: React.FC<MetricRowProps> = ({
    label,
    description,
    value,
    unit = "",
    benchmarkLow = 0,
    benchmarkHigh = 100,
    inverse = false,
    evidenceLinks = [],
    onVideoJump,
}) => {
    const dispatch = useDispatch();
    const activeEvidenceTimestamp = useSelector((state: RootState) => state.cps.activeEvidenceTimestamp);
    
    // Handle N/A case when value is null
    const isNA = value === null;
    
    // Calculate position on scale (0-100%)
    const range = benchmarkHigh - benchmarkLow;
    const position = isNA ? 0 : Math.max(0, Math.min(100, ((value - benchmarkLow) / range) * 100));

    // Determine color and status based on position and inverse flag
    const getStatus = () => {
        if (isNA) {
            return { color: "bg-gray-400", text: "N/A", gradient: "from-gray-50 to-gray-50" };
        }
        if (inverse) {
            // Lower is better (iteration speed)
            if (value <= benchmarkLow * 1.5) return { color: "bg-emerald-500", text: "Excellent", gradient: "from-emerald-50 via-yellow-50 to-red-50" };
            if (value >= benchmarkHigh * 0.8) return { color: "bg-red-500", text: "Needs Improvement", gradient: "from-emerald-50 via-yellow-50 to-red-50" };
            return { color: "bg-amber-500", text: "Good", gradient: "from-emerald-50 via-yellow-50 to-red-50" };
        } else {
            // Higher is better (scores, accountability)
            if (value >= benchmarkHigh * 0.75) return { color: "bg-emerald-500", text: "Excellent", gradient: "from-red-50 via-yellow-50 to-emerald-50" };
            if (value >= benchmarkHigh * 0.5) return { color: "bg-amber-500", text: "Good", gradient: "from-red-50 via-yellow-50 to-emerald-50" };
            return { color: "bg-red-500", text: "Needs Improvement", gradient: "from-red-50 via-yellow-50 to-emerald-50" };
        }
    };

    const status = getStatus();

    // Normalize evidence links to handle both formats
    const normalizedLinks: EvidenceLink[] = evidenceLinks.map(link => 
        typeof link === 'number' ? { timestamp: link } : link
    );

    // Helper to get status badge icon and color
    const getStatusBadge = (evaluation?: string) => {
        if (!evaluation) return null;
        
        switch (evaluation) {
            case "CORRECT":
                return (
                    <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                        <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                );
            case "PARTIAL":
                return (
                    <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-500 flex items-center justify-center shadow-sm">
                        <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" strokeWidth={2} />
                            <line x1="8" y1="12" x2="16" y2="12" strokeWidth={2} strokeLinecap="round" />
                        </svg>
                    </div>
                );
            case "INCORRECT":
                return (
                    <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 flex items-center justify-center shadow-sm">
                        <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="py-4 px-3 hover:bg-gray-50/30 transition-all duration-200 rounded-lg group">
            <div className="flex items-start justify-between gap-6">
                {/* Left: Label and Description */}
                <div className="flex-shrink-0 w-[180px]">
                    <div className="text-sm font-semibold text-gray-800">
                        {label}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-relaxed break-words">
                        {description}
                    </div>
                </div>

                {/* Right: Scale and Value */}
                <div className="flex-1 flex items-center gap-4 min-w-0">
                    {/* Visual Scale */}
                    <div className="flex-1 min-w-[120px] max-w-[200px]">
                        <div className={`relative h-2 rounded-full bg-gradient-to-r ${status.gradient} shadow-inner`}>
                            {/* Candidate position marker */}
                            <div
                                className="absolute top-1/2 -translate-y-1/2 transition-all duration-300 ease-out"
                                style={{
                                    left: `${position}%`,
                                }}
                            >
                                <div className={`w-4 h-4 rounded-full ${status.color} shadow-lg border-2 border-white transform -translate-x-1/2 group-hover:scale-110 transition-transform`} />
                            </div>
                        </div>
                        {/* Status text */}
                        <div className="text-[10px] text-gray-400 mt-1 text-center font-medium">
                            {status.text}
                        </div>
                    </div>

                    {/* Value */}
                    <div className="text-right flex-shrink-0 w-[70px]">
                        <span className="text-2xl font-bold text-gray-900 tabular-nums">
                            {isNA ? "N/A" : value}
                        </span>
                        {!isNA && unit && <span className="text-sm text-gray-500 ml-1">{unit}</span>}
                    </div>
                </div>
            </div>

            {/* Evidence Links - Apple-inspired play buttons with status badges */}
            {evidenceLinks && evidenceLinks.length > 0 && onVideoJump && (
                <div className="mt-3 flex gap-2">
                    {normalizedLinks.map((link, index) => {
                        const isActive = activeEvidenceTimestamp === link.timestamp;
                        return (
                            <button
                                key={index}
                                onClick={() => {
                                    dispatch(setActiveEvidenceTimestamp(link.timestamp));
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
                                    .padStart(2, "0")} - ${link.evaluation || "N/A"}`}
                            >
                                {/* Play icon */}
                                <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                                
                                {/* Status badge */}
                                {getStatusBadge(link.evaluation)}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default MetricRow;

