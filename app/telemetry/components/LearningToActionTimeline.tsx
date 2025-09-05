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

interface LearningToActionTimelineProps {
    onVideoJump: (timestamp: number) => void;
}

const LearningToActionTimeline: React.FC<LearningToActionTimelineProps> = ({
    onVideoJump,
}) => {
    const data = [
        { time: "Research", value: 1, timestamp: 90, color: "#3b82f6" },
        { time: "Implement", value: 2, timestamp: 120, color: "#eab308" },
        { time: "Success", value: 3, timestamp: 270, color: "#22c55e" },
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
                Learning-to-Action Timeline
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
                        tick={{ fontSize: 10, fill: "#6b7280" }}
                    />
                    <YAxis hide />
                    <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#6366f1"
                        strokeWidth={3}
                        dot={<CustomDot />}
                        activeDot={false}
                    />
                </LineChart>
            </ResponsiveContainer>
            <div className="text-xs text-gray-500 text-center mt-1">
                Research → Implementation → Success flow
            </div>
        </div>
    );
};

export default LearningToActionTimeline;
