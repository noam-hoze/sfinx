"use client";

import { useEffect, useState } from "react";

// A placeholder for the analysis data structure
type AnalysisData = {
    au_time_series: { [key: string]: number[] };
    gaze_vectors: unknown[];
    head_pose: unknown[];
    summary: {
        engagement: number;
        stress_level: number;
        smile_frequency: number;
    };
};

export default function ResultsPage({
    params,
}: {
    params: { videoId: string };
}) {
    const { videoId } = params;
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [analysis, setAnalysis] = useState<AnalysisData | null>(null);

    useEffect(() => {
        const fetchAnalysis = async () => {
            try {
                // We will create this API route next
                const response = await fetch(`/api/results/${videoId}`);
                if (!response.ok) {
                    throw new Error("Failed to fetch analysis data.");
                }
                const data = await response.json();
                setAnalysis(data);
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "An unknown error occurred."
                );
            } finally {
                setLoading(false);
            }
        };

        fetchAnalysis();
    }, [videoId]);

    if (loading) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center p-24">
                <h1 className="text-4xl font-bold mb-4">
                    Processing Analysis...
                </h1>
                <p>Your interview results are being processed. Please wait.</p>
            </main>
        );
    }

    if (error) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center p-24">
                <h1 className="text-4xl font-bold text-red-500 mb-4">Error</h1>
                <p>{error}</p>
            </main>
        );
    }

    return (
        <main className="flex min-h-screen flex-col items-center p-24">
            <h1 className="text-4xl font-bold mb-8">
                Interview Analysis Results
            </h1>
            {analysis ? (
                <div className="w-full max-w-4xl">
                    <h2 className="text-2xl font-semibold mb-4">
                        Summary Insights
                    </h2>
                    <ul>
                        <li>
                            Engagement Score:{" "}
                            {analysis.summary.engagement.toFixed(2)}
                        </li>
                        <li>
                            Stress Level:{" "}
                            {analysis.summary.stress_level.toFixed(2)}
                        </li>
                        <li>
                            Smile Frequency:{" "}
                            {analysis.summary.smile_frequency.toFixed(2)} times
                            per minute
                        </li>
                    </ul>

                    <h2 className="text-2xl font-semibold mt-8 mb-4">
                        Detailed Charts
                    </h2>
                    <p>
                        Chart components for time-series data (e.g., AU12, AU4)
                        will go here.
                    </p>
                    {/* Placeholder for charts */}
                    <div className="w-full h-64 bg-gray-200 rounded mt-4 flex items-center justify-center">
                        <p className="text-gray-500">
                            Action Unit Time-Series Chart
                        </p>
                    </div>
                </div>
            ) : (
                <p>No analysis data available.</p>
            )}
        </main>
    );
}
