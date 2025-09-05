"use client";

import React from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    ResponsiveContainer,
    Cell,
} from "recharts";

interface PersistenceFlowProps {
    onVideoJump: (timestamp: number) => void;
}

const PersistenceFlow: React.FC<PersistenceFlowProps> = ({ onVideoJump }) => {
    const data = [
        { name: "Attempt #1", attempts: 1, timestamp: 75, color: "#ef4444" },
        { name: "Attempt #2", attempts: 2, timestamp: 165, color: "#f97316" },
        { name: "Attempt #3", attempts: 3, timestamp: 260, color: "#22c55e" },
    ];

    const handleBarClick = (data: any) => {
        if (data && data.timestamp) {
            onVideoJump(data.timestamp);
        }
    };

    return (
        <div className="bg-white rounded-lg p-3 h-48">
            <h3 className="text-xs font-semibold text-gray-900 mb-2">
                Persistence Flow
            </h3>
            <ResponsiveContainer width="100%" height="70%">
                <BarChart
                    data={data}
                    margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                >
                    <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: "#6b7280" }}
                    />
                    <YAxis hide />
                    <Bar
                        dataKey="attempts"
                        radius={[4, 4, 0, 0]}
                        onClick={handleBarClick}
                        cursor="pointer"
                    >
                        {data.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.color}
                                className="hover:opacity-80 transition-opacity"
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
            <div className="text-xs text-gray-500 text-center mt-1">
                Gal tried 3 approaches before success
            </div>
        </div>
    );
};

export default PersistenceFlow;
