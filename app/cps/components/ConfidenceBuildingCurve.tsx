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
import { Info } from "lucide-react";

interface ConfidencePoint {
    time: string;
    confidence: number;
    timestamp: number;
    color?: string;
}

interface ConfidenceBuildingCurveProps {
    data?: ConfidencePoint[];
    onVideoJump: (timestamp: number) => void;
}

const ConfidenceBuildingCurve: React.FC<ConfidenceBuildingCurveProps> = ({
    data = [],
    onVideoJump,
}) => {
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
                className="cursor-pointer hover:opacity-80 focus:outline-none focus:ring-0 active:outline-none"
                style={{ outline: "none" }}
                tabIndex={-1}
                onClick={() => onVideoJump(payload.timestamp)}
            />
        );
    };

    return (
        <div className="bg-white rounded-lg p-3 h-48">
            <h3 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-1">
                Confidence Building Curve
                <div className="group relative flex items-center">
                    <Info size={12} className="text-gray-400" />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 bg-white text-black text-xs rounded py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none border border-gray-200 shadow-lg z-10 whitespace-normal">
                        Confidence over time during the task. Dips typically
                        mark blockers or wrong turns; rises follow breakthroughs
                        and verified results. A healthy curve shows recovery
                        after setbacks and steady growth toward mastery by
                        session end.
                    </div>
                </div>
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
                {data.length === 0
                    ? "No data yet"
                    : "From uncertainty to confident mastery"}
            </div>
        </div>
    );
};

export default ConfidenceBuildingCurve;
