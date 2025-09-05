"use client";

import React from "react";
import {
    AreaChart,
    Area,
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
        { time: "Low", confidence: 25, timestamp: 75, color: "#ef4444" },
        { time: "Medium", confidence: 60, timestamp: 180, color: "#eab308" },
        { time: "High", confidence: 90, timestamp: 300, color: "#22c55e" },
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
                <AreaChart
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
                    <Area
                        type="monotone"
                        dataKey="confidence"
                        stroke="#6366f1"
                        strokeWidth={2}
                        fill="url(#colorConfidence)"
                        dot={<CustomDot />}
                    />
                    <defs>
                        <linearGradient
                            id="colorConfidence"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop
                                offset="5%"
                                stopColor="#6366f1"
                                stopOpacity={0.3}
                            />
                            <stop
                                offset="95%"
                                stopColor="#6366f1"
                                stopOpacity={0.1}
                            />
                        </linearGradient>
                    </defs>
                </AreaChart>
            </ResponsiveContainer>
            <div className="text-xs text-gray-500 text-center mt-1">
                From uncertainty to confident mastery
            </div>
        </div>
    );
};

export default ConfidenceBuildingCurve;
