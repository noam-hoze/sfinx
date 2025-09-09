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

interface LearningPoint {
    time: string;
    value: number;
    timestamp: number;
    color?: string;
}

interface LearningToActionTimelineProps {
    data?: LearningPoint[];
    onVideoJump: (timestamp: number) => void;
}

const LearningToActionTimeline: React.FC<LearningToActionTimelineProps> = ({
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
                Learning-to-Action Timeline
                <div className="group relative flex items-center">
                    <Info size={12} className="text-gray-400" />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 bg-white text-black text-xs rounded py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none border border-gray-200 shadow-lg z-10 whitespace-normal">
                        Information retrieval and hypothesis testing during
                        problem solving. We track doc/IDE opens, internal
                        searches, and external lookups (counts and dwell; no
                        content). Strong signals: diverse sources, purposeful
                        lookups, and quick conversion from learning to working
                        code.
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
                        dataKey="value"
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
                    : "Research → Implementation → Success flow"}
            </div>
        </div>
    );
};

export default LearningToActionTimeline;
