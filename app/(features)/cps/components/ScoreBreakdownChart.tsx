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

    // SVG circle properties
    const size = 200;
    const center = size / 2;
    const radius = 80;
    const strokeWidth = 40;

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

    return (
        <div className="flex flex-col items-center gap-4 py-4">
            {/* Overall Score Display */}
            <div className="text-center mb-2">
                <div className="text-4xl font-bold text-gray-900">{overallScore}%</div>
                <div className="text-sm text-gray-500">Overall Score</div>
            </div>

            {/* Pie Chart */}
            <svg width={size} height={size} className="drop-shadow-sm">
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

            {/* Legend */}
            <div className="flex flex-col gap-2 w-full">
                <div className="flex items-center justify-between px-3 py-2 bg-indigo-50 rounded-lg">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#6366f1]"></div>
                        <span className="text-sm font-medium text-gray-700">Experience</span>
                    </div>
                    <div className="text-sm text-gray-600">
                        <span className="font-semibold">{experienceScore} pts</span>
                        <span className="text-gray-400 ml-1">({experienceWeight}%)</span>
                    </div>
                </div>
                
                <div className="flex items-center justify-between px-3 py-2 bg-purple-50 rounded-lg">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#8b5cf6]"></div>
                        <span className="text-sm font-medium text-gray-700">Coding</span>
                    </div>
                    <div className="text-sm text-gray-600">
                        <span className="font-semibold">{codingScore} pts</span>
                        <span className="text-gray-400 ml-1">({codingWeight}%)</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

