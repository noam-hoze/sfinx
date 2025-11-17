import React from "react";

interface MetricRowProps {
    label: string;
    description: string;
    value: number;
    unit?: string;
    benchmarkLow?: number;
    benchmarkHigh?: number;
    inverse?: boolean; // For metrics where lower is better (iteration speed, debug loops)
    evidenceLinks?: number[]; // Video timestamps for evidence
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
    const [clickedTimestamp, setClickedTimestamp] = React.useState<number | null>(null);
    // Calculate position on scale (0-100%)
    const range = benchmarkHigh - benchmarkLow;
    const position = Math.max(0, Math.min(100, ((value - benchmarkLow) / range) * 100));

    // Determine color and status based on position and inverse flag
    const getStatus = () => {
        if (inverse) {
            // Lower is better (iteration speed, debug loops)
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
                            {value}
                        </span>
                        {unit && <span className="text-sm text-gray-500 ml-1">{unit}</span>}
                    </div>
                </div>
            </div>

            {/* Evidence Links */}
            {evidenceLinks && evidenceLinks.length > 0 && onVideoJump && (
                <div className="mt-2 flex gap-1 pl-[196px]">
                    {evidenceLinks.map((timestamp, index) => (
                        <button
                            key={index}
                            onClick={() => {
                                setClickedTimestamp(timestamp);
                                onVideoJump(timestamp);
                            }}
                            className={`w-6 h-6 flex items-center justify-center text-xs font-medium rounded transition-all duration-200 !cursor-pointer ${
                                clickedTimestamp === timestamp
                                    ? "text-blue-600 bg-blue-50"
                                    : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                            }`}
                            style={{ cursor: 'pointer' }}
                            title={`Jump to ${Math.floor(timestamp / 60)}:${(timestamp % 60)
                                .toString()
                                .padStart(2, "0")}`}
                        >
                            {index + 1}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MetricRow;

