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

interface LearningToActionTimelineProps {
    onVideoJump: (timestamp: number) => void;
}

const LearningToActionTimeline: React.FC<LearningToActionTimelineProps> = ({
    onVideoJump,
}) => {
    const data = [
        { time: "0:00", value: 0.8, timestamp: 0, color: "#3b82f6" }, // Initial research
        { time: "0:45", value: 0.5, timestamp: 45, color: "#3b82f6" }, // Got confused, stepped back
        { time: "1:30", value: 1.2, timestamp: 90, color: "#3b82f6" }, // Found some direction
        { time: "2:15", value: 0.9, timestamp: 135, color: "#eab308" }, // Hit implementation wall
        { time: "2:45", value: 1.8, timestamp: 165, color: "#eab308" }, // Breakthrough after debugging
        { time: "3:30", value: 1.4, timestamp: 210, color: "#eab308" }, // Refactoring needed
        { time: "4:15", value: 2.3, timestamp: 255, color: "#22c55e" }, // Clean implementation
        { time: "5:00", value: 2.7, timestamp: 300, color: "#22c55e" }, // Final polish
        { time: "5:30", value: 3, timestamp: 330, color: "#22c55e" }, // Success!
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
                        Visualizes the candidate's journey from research to
                        implementation.
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
                Research → Implementation → Success flow
            </div>
        </div>
    );
};

export default LearningToActionTimeline;
