"use client";

import React from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    ResponsiveContainer,
    Dot,
} from "recharts";

interface ConfidenceBuildingCurveProps {
    onVideoJump: (timestamp: number) => void;
}

const ConfidenceBuildingCurve: React.FC<ConfidenceBuildingCurveProps> = ({
    onVideoJump,
}) => {
    const data = [
        { time: "0:00", confidence: 15, timestamp: 0, color: "#ef4444" },
        { time: "0:45", confidence: 35, timestamp: 45, color: "#ef4444" },
        { time: "1:15", confidence: 20, timestamp: 75, color: "#ef4444" }, // Got stuck, confidence dropped
        { time: "1:45", confidence: 45, timestamp: 105, color: "#eab308" }, // Breakthrough after research
        { time: "2:30", confidence: 30, timestamp: 150, color: "#eab308" }, // Another hurdle
        { time: "3:15", confidence: 65, timestamp: 195, color: "#eab308" }, // Steady progress
        { time: "4:00", confidence: 50, timestamp: 240, color: "#eab308" }, // Temporary setback
        { time: "4:45", confidence: 80, timestamp: 285, color: "#22c55e" }, // Major breakthrough
        { time: "5:30", confidence: 95, timestamp: 330, color: "#22c55e" }, // Confident mastery
    ];

    const CustomDot = (props: any) => {
        const { cx, cy, payload } = props;
        return (
            <Dot
                cx={cx}
                cy={cy}
                r={6}
                fill={payload.color}
                stroke="#fff"
                strokeWidth={2}
                className="cursor-pointer hover:opacity-80"
                onClick={() => onVideoJump(payload.timestamp)}
            />
        );
    };

    return (
        <div className="bg-white rounded-lg p-3 h-48">
            <h3 className="text-xs font-semibold text-gray-900 mb-2">
                Confidence Building Curve
            </h3>
            <ResponsiveContainer width="100%" height="70%">
                <LineChart
                    data={data}
                    margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
                >
                    <XAxis
                        dataKey="time"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 9, fill: "#9ca3af", fontWeight: 500 }}
                        interval={0}
                        angle={0}
                        textAnchor="middle"
                    />
                    <YAxis hide />
                    <Line
                        type="monotone"
                        dataKey="confidence"
                        stroke="#6366f1"
                        strokeWidth={3}
                        dot={<CustomDot />}
                        activeDot={false}
                    />
                </LineChart>
            </ResponsiveContainer>
            <div className="text-xs text-gray-500 text-center mt-1">
                From uncertainty to confident mastery
            </div>
        </div>
    );
};

export default ConfidenceBuildingCurve;
