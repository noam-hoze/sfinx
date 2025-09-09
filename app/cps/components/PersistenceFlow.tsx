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

interface PersistenceFlowItem {
    name: string;
    attempts: number;
    timestamp: number;
    color?: string;
}

interface PersistenceFlowProps {
    data?: PersistenceFlowItem[];
    onVideoJump: (timestamp: number) => void;
}

const PersistenceFlow: React.FC<PersistenceFlowProps> = ({
    data = [],
    onVideoJump,
}) => {
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
                                fill={entry.color || "#9ca3af"}
                                className="hover:opacity-80 transition-opacity"
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
            <div className="text-xs text-gray-500 text-center mt-1">
                {data.length === 0
                    ? "No data yet"
                    : `${data.length} approaches recorded`}
            </div>
        </div>
    );
};

export default PersistenceFlow;
