import { Suspense } from "react";

type AnalysisData = {
    pitch: number;
    jitter: number;
    loudness: number;
    harshness: number;
};

// Simple interpretation logic
const interpretAnalysis = (data: AnalysisData) => {
    const interpretations = {
        vocalStress: "Low",
        confidence: "Medium",
        engagement: "Medium",
    };

    // Vocal Stress: Higher pitch and harshness can indicate stress.
    if (data.pitch > 180 && data.harshness > 15) {
        interpretations.vocalStress = "High";
    } else if (data.pitch > 150 || data.harshness > 10) {
        interpretations.vocalStress = "Medium";
    }

    // Confidence: Low jitter (voice stability) and stable loudness can indicate confidence.
    if (data.jitter < 0.01) {
        interpretations.confidence = "High";
    } else if (data.jitter > 0.02) {
        interpretations.confidence = "Low";
    }

    // Engagement: Wider loudness range can indicate more dynamic/engaging speech.
    if (data.loudness > 0.5) {
        interpretations.engagement = "High";
    } else if (data.loudness < 0.1) {
        interpretations.engagement = "Low";
    }

    return interpretations;
};

function AnalysisDisplay({
    videoId,
    analysis,
    error,
}: {
    videoId: string;
    analysis: AnalysisData | null;
    error: string | null;
}) {
    const interpretations = analysis ? interpretAnalysis(analysis) : null;

    return (
        <div className="container mx-auto p-8">
            <h1 className="text-4xl font-bold mb-4">Interview Analysis</h1>
            <h2 className="text-xl text-gray-400 mb-8">Video ID: {videoId}</h2>

            {!analysis && !error && (
                <p className="text-lg">Analyzing voice... Please wait.</p>
            )}
            {error && <p className="text-lg text-red-500">Error: {error}</p>}

            {analysis && interpretations && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Soft Skill Proxies */}
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                        <h3 className="text-2xl font-semibold mb-4">
                            Soft Skill Proxies
                        </h3>
                        <ul className="space-y-4">
                            <li className="flex justify-between items-center">
                                <span className="text-gray-300">
                                    Vocal Stress:
                                </span>{" "}
                                <span className="text-xl font-bold">
                                    {interpretations.vocalStress}
                                </span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="text-gray-300">
                                    Confidence:
                                </span>{" "}
                                <span className="text-xl font-bold">
                                    {interpretations.confidence}
                                </span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="text-gray-300">
                                    Engagement:
                                </span>{" "}
                                <span className="text-xl font-bold">
                                    {interpretations.engagement}
                                </span>
                            </li>
                        </ul>
                    </div>
                    {/* Raw Feature Data */}
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                        <h3 className="text-2xl font-semibold mb-4">
                            Raw Voice Features
                        </h3>
                        <ul className="space-y-4">
                            <li className="flex justify-between items-center">
                                <span className="text-gray-300">
                                    Pitch (F0):
                                </span>{" "}
                                <span className="text-xl font-mono">
                                    {analysis.pitch.toFixed(2)} Hz
                                </span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="text-gray-300">
                                    Jitter (Stability):
                                </span>{" "}
                                <span className="text-xl font-mono">
                                    {analysis.jitter.toFixed(4)}
                                </span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="text-gray-300">Loudness:</span>{" "}
                                <span className="text-xl font-mono">
                                    {analysis.loudness.toFixed(2)}
                                </span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="text-gray-300">
                                    Harshness (Alpha Ratio):
                                </span>{" "}
                                <span className="text-xl font-mono">
                                    {analysis.harshness.toFixed(2)}
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}

async function fetchAnalysisData(videoId: string) {
    // This fetch call is now happening on the server-side.
    // We need to provide the full URL.
    const host = process.env.NEXT_PUBLIC_HOST || "http://localhost:3000";
    try {
        const response = await fetch(`${host}/api/results/${videoId}`);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to fetch analysis.");
        }
        const data = await response.json();
        if (data.success) {
            return { analysis: data.analysis, error: null };
        } else {
            throw new Error(data.error || "Analysis failed.");
        }
    } catch (err: any) {
        return { analysis: null, error: err.message };
    }
}

export default async function ResultsPage({
    params,
}: {
    params: { videoId: string };
}) {
    const { videoId } = params;
    const { analysis, error } = await fetchAnalysisData(videoId);

    return (
        <Suspense fallback={<p>Loading video analysis...</p>}>
            <AnalysisDisplay
                videoId={videoId}
                analysis={analysis}
                error={error}
            />
        </Suspense>
    );
}
