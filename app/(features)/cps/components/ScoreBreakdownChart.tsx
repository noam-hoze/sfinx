"use client";

import React from "react";

interface ScoreBreakdownChartProps {
    experienceScore: number; // 0-100
    codingScore: number; // 0-100
    experienceWeight?: number; // 0-100 (default 50)
    codingWeight?: number; // 0-100 (default 50)
}

export default function ScoreBreakdownChart({
    experienceScore,
    codingScore,
    experienceWeight = 50,
    codingWeight = 50,
}: ScoreBreakdownChartProps) {
    // Calculate overall score based on weights
    const overallScore = Math.round(
        (experienceScore * experienceWeight + codingScore * codingWeight) / 100
    );

    // Calculate pie chart angles
    const experienceAngle = (experienceWeight / 100) * 360;
    const codingAngle = (codingWeight / 100) * 360;

    // SVG circle properties for smaller chart
    const size = 140;
    const center = size / 2;
    const radius = 60;
    const strokeWidth = 30;

    // Calculate path for Experience slice
    const experienceEndAngle = experienceAngle;
    const experienceX = center + radius * Math.sin((experienceEndAngle * Math.PI) / 180);
    const experienceY = center - radius * Math.cos((experienceEndAngle * Math.PI) / 180);
    const experienceLargeArc = experienceAngle > 180 ? 1 : 0;

    const experiencePath = `
        M ${center} ${center - radius}
        A ${radius} ${radius} 0 ${experienceLargeArc} 1 ${experienceX} ${experienceY}
        L ${center} ${center}
        Z
    `;

    // Calculate path for Coding slice
    const codingStartAngle = experienceAngle;
    const codingEndAngle = codingStartAngle + codingAngle;
    const codingStartX = center + radius * Math.sin((codingStartAngle * Math.PI) / 180);
    const codingStartY = center - radius * Math.cos((codingStartAngle * Math.PI) / 180);
    const codingEndX = center + radius * Math.sin((codingEndAngle * Math.PI) / 180);
    const codingEndY = center - radius * Math.cos((codingEndAngle * Math.PI) / 180);
    const codingLargeArc = codingAngle > 180 ? 1 : 0;

    const codingPath = `
        M ${center} ${center}
        L ${codingStartX} ${codingStartY}
        A ${radius} ${radius} 0 ${codingLargeArc} 1 ${codingEndX} ${codingEndY}
        L ${center} ${center}
        Z
    `;

    // Calculate position and status for the overall score
    const position = overallScore;
    const getStatus = () => {
        if (overallScore >= 75) return { color: "bg-emerald-500", text: "Excellent", gradient: "from-red-50 via-yellow-50 to-emerald-50" };
        if (overallScore >= 50) return { color: "bg-amber-500", text: "Good", gradient: "from-red-50 via-yellow-50 to-emerald-50" };
        return { color: "bg-red-500", text: "Needs Improvement", gradient: "from-red-50 via-yellow-50 to-emerald-50" };
    };
    const status = getStatus();

    return (
        <div className="space-y-4">
            {/* Overall Score Row - aligned like MetricRow */}
            <div className="py-4 px-3 rounded-lg">
                <div className="flex items-center justify-between gap-6">
                    {/* Left: Pie Chart */}
                    <svg width={size} height={size} className="drop-shadow-sm flex-shrink-0">
                        {/* Experience Slice */}
                        <path
                            d={experiencePath}
                            fill="#6366f1"
                            className="transition-all duration-300 hover:opacity-90"
                        />
                        
                        {/* Coding Slice */}
                        <path
                            d={codingPath}
                            fill="#8b5cf6"
                            className="transition-all duration-300 hover:opacity-90"
                        />

                        {/* Center Circle for donut effect */}
                        <circle
                            cx={center}
                            cy={center}
                            r={radius - strokeWidth}
                            fill="white"
                        />
                    </svg>

                    {/* Right: Scale and Overall Score */}
                    <div className="flex-1 flex items-center gap-4 min-w-0">
                        {/* Visual Scale */}
                        <div className="flex-1 min-w-[120px] max-w-[200px]">
                            <div className={`relative h-2 rounded-full bg-gradient-to-r ${status.gradient} shadow-inner`}>
                                {/* Score position marker */}
                                <div
                                    className="absolute top-1/2 -translate-y-1/2 transition-all duration-300 ease-out"
                                    style={{
                                        left: `${position}%`,
                                    }}
                                >
                                    <div className={`w-4 h-4 rounded-full ${status.color} shadow-lg border-2 border-white transform -translate-x-1/2 transition-transform`} />
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
                                {overallScore}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-col gap-2 px-3">
                <div className="flex items-center justify-between px-3 py-2 bg-indigo-50 rounded-lg">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#6366f1]"></div>
                        <span className="text-xs font-medium text-gray-600">Experience</span>
                    </div>
                    <div className="text-xs text-gray-500">
                        <span className="font-semibold">{experienceScore} pts</span>
                        <span className="text-gray-400 ml-1">({experienceWeight}%)</span>
                    </div>
                </div>
                
                <div className="flex items-center justify-between px-3 py-2 bg-purple-50 rounded-lg">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#8b5cf6]"></div>
                        <span className="text-xs font-medium text-gray-600">Coding</span>
                    </div>
                    <div className="text-xs text-gray-500">
                        <span className="font-semibold">{codingScore} pts</span>
                        <span className="text-gray-400 ml-1">({codingWeight}%)</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

