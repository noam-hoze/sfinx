"use client";

import React from "react";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Dot,
    Tooltip,
} from "recharts";

export interface ImprovementDatum {
    label: string;
    index: number;
    sessionIndex?: number;
    match: number | null;
    iter?: number | null;
    refactor?: number | null;
    debug?: number | null; // higher = better (inverted upstream)
    ai?: number | null; // higher = better (inverted upstream)
    // Optional: flip-low-is-better metrics if added later
    matchTs?: number;
    iterTs?: number;
    refactorTs?: number;
    debugTs?: number;
    aiTs?: number;
}

export default function ImprovementChart({
    data,
    activeIndex,
    onSelect,
    show,
}: {
    data: ImprovementDatum[];
    activeIndex: number;
    onSelect: (index: number, timestamp?: number) => void;
    show?: {
        match?: boolean;
        iter?: boolean;
        refactor?: boolean;
        debug?: boolean;
        ai?: boolean;
    };
}) {
    // Ensure sessions render left-to-right as S1 → S5
    const ordered = React.useMemo(
        () => [...data].sort((a, b) => a.index - b.index),
        [data]
    );
    // Compute tighter domain for high-range metrics to create more vertical spread
    const highMins = ordered
        .flatMap((d) => [d.match, d.iter, d.refactor])
        .filter((v) => typeof v === "number") as number[];
    const minHigh = highMins.length ? Math.min(...highMins) : 0;
    const domainHigh: [number, number] = [
        Math.max(0, Math.floor(minHigh - 6)),
        100,
    ];
    const CustomDot = (key: "match" | "iter" | "refactor" | "debug" | "ai") => {
        const DotComponent = (props: any) => {
            const { cx, cy, payload, index } = props;
            const isActive =
                (payload.sessionIndex ?? payload.index) === activeIndex &&
                key === "match";
            const color =
                key === "match"
                    ? "#3b82f6"
                    : key === "iter"
                    ? "#a78bfa"
                    : key === "refactor"
                    ? "#10b981"
                    : key === "debug"
                    ? "#f97316"
                    : "#64748b"; // ai
            const tsKey =
                key === "match"
                    ? "matchTs"
                    : key === "iter"
                    ? "iterTs"
                    : key === "refactor"
                    ? "refactorTs"
                    : key === "debug"
                    ? "debugTs"
                    : "aiTs";
            const prev = ordered[index - 1];
            const val = payload[key];
            const prevVal = prev ? (prev as any)[key] : null;
            const trendStroke =
                prevVal == null || val == null
                    ? "#ffffff"
                    : (val as number) > (prevVal as number)
                    ? "#10b981"
                    : (val as number) < (prevVal as number)
                    ? "#ef4444"
                    : "#ffffff";
            return (
                <Dot
                    cx={cx}
                    cy={cy}
                    r={isActive ? 6 : 4}
                    fill={color}
                    stroke={trendStroke}
                    strokeWidth={2}
                    className="cursor-pointer hover:opacity-80 focus:outline-none"
                    onClick={() =>
                        onSelect(
                            payload.sessionIndex ?? payload.index,
                            payload[tsKey]
                        )
                    }
                />
            );
        };
        DotComponent.displayName = `CustomDot-${key}`;
        return DotComponent;
    };

    return (
        <div className="bg-white rounded-lg p-2 h-full">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={ordered}
                    margin={{ top: 16, right: 16, left: 16, bottom: 20 }}
                >
                    <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                            fontSize: 10,
                            fill: "#9ca3af",
                            fontWeight: 500,
                        }}
                        interval={0}
                        label={{
                            value: "Earlier  →  Latest",
                            position: "insideBottom",
                            offset: 0,
                            style: { fill: "#9ca3af", fontSize: 10 },
                        }}
                    />
                    <YAxis
                        yAxisId="a"
                        hide={false}
                        domain={domainHigh}
                        axisLine={false}
                        tickLine={false}
                        tick={false}
                        label={{
                            value: "Improving →",
                            angle: -90,
                            position: "insideLeft",
                            style: { fill: "#9ca3af", fontSize: 10 },
                        }}
                    />
                    <YAxis
                        yAxisId="b"
                        orientation="right"
                        hide
                        domain={[0, 100]}
                    />
                    <Tooltip
                        formatter={(value: any, name: any) => [
                            typeof value === "number" ? `${value}%` : "-",
                            name === "match"
                                ? "Match"
                                : name === "iter"
                                ? "Iterations to Success"
                                : name === "refactor"
                                ? "Refactor & Cleanups"
                                : name === "debug"
                                ? "Debug (↑ better)"
                                : "AI Assist (↓ usage)",
                        ]}
                        labelFormatter={(l) => `Session ${l}`}
                    />
                    {/* Primary trajectory */}
                    {show?.match !== false && (
                        <Line
                            type="monotone"
                            dataKey="match"
                            stroke="#3b82f6"
                            strokeWidth={3}
                            yAxisId="a"
                            dot={CustomDot("match")}
                            activeDot={false}
                            connectNulls
                        />
                    )}
                    {/* Supporting signals for more points */}
                    {show?.iter !== false && (
                        <Line
                            type="monotone"
                            dataKey="iter"
                            stroke="#a78bfa"
                            strokeWidth={2}
                            yAxisId="a"
                            dot={CustomDot("iter")}
                            activeDot={false}
                            connectNulls
                        />
                    )}
                    {show?.refactor !== false && (
                        <Line
                            type="monotone"
                            dataKey="refactor"
                            stroke="#10b981"
                            strokeWidth={2}
                            yAxisId="a"
                            dot={CustomDot("refactor")}
                            activeDot={false}
                            connectNulls
                        />
                    )}
                    {show?.debug !== false && (
                        <Line
                            type="monotone"
                            dataKey="debug"
                            stroke="#f97316"
                            strokeWidth={2}
                            yAxisId="b"
                            dot={CustomDot("debug")}
                            activeDot={false}
                            connectNulls
                        />
                    )}
                    {show?.ai !== false && (
                        <Line
                            type="monotone"
                            dataKey="ai"
                            stroke="#64748b"
                            strokeWidth={2}
                            yAxisId="b"
                            dot={CustomDot("ai")}
                            activeDot={false}
                            connectNulls
                        />
                    )}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
