// Graph datasets for Gal

export type LearningPoint = {
    time: string;
    value: number;
    timestamp: number;
    color?: string;
};

export type ConfidencePoint = {
    time: string;
    confidence: number;
    timestamp: number;
    color?: string;
};

export const galLearningToAction: LearningPoint[] = [
    { time: "0:00", value: 20, timestamp: 0, color: "#94a3b8" },
    { time: "0:37", value: 35, timestamp: 37 },
    { time: "1:08", value: 25, timestamp: 68, color: "#ef4444" },
    { time: "1:29", value: 60, timestamp: 89, color: "#22c55e" },
    { time: "2:10", value: 75, timestamp: 130, color: "#22c55e" },
    { time: "3:26", value: 85, timestamp: 206, color: "#3b82f6" },
];

export const galConfidenceCurve: ConfidencePoint[] = [
    { time: "0:00", confidence: 40, timestamp: 0 },
    { time: "1:08", confidence: 30, timestamp: 68, color: "#ef4444" },
    { time: "1:29", confidence: 55, timestamp: 89, color: "#22c55e" },
    { time: "1:31", confidence: 60, timestamp: 91 },
    { time: "2:10", confidence: 75, timestamp: 130, color: "#22c55e" },
    { time: "3:26", confidence: 82, timestamp: 206 },
];
