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
        { name: "0:30", attempts: 1, timestamp: 30, color: "#ef4444" }, // First quick attempt - failed
        { name: "1:15", attempts: 2, timestamp: 75, color: "#ef4444" }, // Second attempt - still struggling
        { name: "2:00", attempts: 3, timestamp: 120, color: "#f97316" }, // Third attempt - better but not there
        { name: "2:45", attempts: 4, timestamp: 165, color: "#f97316" }, // Fourth - learning from mistakes
        { name: "3:30", attempts: 5, timestamp: 210, color: "#eab308" }, // Fifth - breakthrough approaching
        { name: "4:20", attempts: 6, timestamp: 260, color: "#22c55e" }, // Sixth - finally got it!
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
                        tick={{ fontSize: 9, fill: "#9ca3af", fontWeight: 500 }}
                        interval={0}
                        angle={0}
                        textAnchor="middle"
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
                Noam tried 6 approaches - persistence pays off!
            </div>
        </div>
    );
};

export default PersistenceFlow;
