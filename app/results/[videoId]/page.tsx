import { Suspense } from "react";
import { headers } from "next/headers";

type VoiceAnalysisData = {
    pitch: number;
    jitter: number;
    loudness: number;
    harshness: number;
};

type VideoAnalysisData = {
    smile: number;
    browFurrow: number;
    mouthOpen: number;
};

type CombinedAnalysisData = {
    voice: VoiceAnalysisData;
    video: VideoAnalysisData;
};

// Simple interpretation logic
const interpretVoiceAnalysis = (data: VoiceAnalysisData) => {
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

const interpretVideoAnalysis = (data: VideoAnalysisData) => {
    return {
        friendliness:
            data.smile > 0.5 ? "High" : data.smile > 0.2 ? "Medium" : "Low",
        attentiveness: data.browFurrow < 0.5 ? "High" : "Low",
        engagement: data.mouthOpen > 0.2 ? "High" : "Low",
    };
};

function AnalysisDisplay({
    videoId,
    analysis,
    error,
}: {
    videoId: string;
    analysis: CombinedAnalysisData | null;
    error: string | null;
}) {
    const voiceInterpretations = analysis
        ? interpretVoiceAnalysis(analysis.voice)
        : null;
    const videoInterpretations = analysis
        ? interpretVideoAnalysis(analysis.video)
        : null;

    return (
        <div className="container mx-auto p-8">
            <h1 className="text-4xl font-bold mb-4">Interview Analysis</h1>
            <h2 className="text-xl text-gray-400 mb-8">Video ID: {videoId}</h2>

            {!analysis && !error && (
                <p className="text-lg">Analyzing interview... Please wait.</p>
            )}
            {error && <p className="text-lg text-red-500">Error: {error}</p>}

            {analysis && voiceInterpretations && videoInterpretations && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Voice Analysis */}
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                        <h3 className="text-2xl font-semibold mb-4">
                            Vocal Insights
                        </h3>
                        <ul className="space-y-4">
                            <li className="flex justify-between items-center">
                                <span className="text-gray-300">
                                    Vocal Stress:
                                </span>
                                <span className="text-xl font-bold">
                                    {voiceInterpretations.vocalStress}
                                </span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="text-gray-300">
                                    Confidence:
                                </span>
                                <span className="text-xl font-bold">
                                    {voiceInterpretations.confidence}
                                </span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="text-gray-300">
                                    Engagement:
                                </span>
                                <span className="text-xl font-bold">
                                    {voiceInterpretations.engagement}
                                </span>
                            </li>
                        </ul>
                    </div>

                    {/* Video Analysis */}
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                        <h3 className="text-2xl font-semibold mb-4">
                            Facial Expression Insights
                        </h3>
                        <ul className="space-y-4">
                            <li className="flex justify-between items-center">
                                <span className="text-gray-300">
                                    Friendliness (Smile):
                                </span>
                                <span className="text-xl font-bold">
                                    {videoInterpretations.friendliness}
                                </span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="text-gray-300">
                                    Attentiveness (Brow):
                                </span>
                                <span className="text-xl font-bold">
                                    {videoInterpretations.attentiveness}
                                </span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="text-gray-300">
                                    Engagement (Mouth):
                                </span>
                                <span className="text-xl font-bold">
                                    {videoInterpretations.engagement}
                                </span>
                            </li>
                        </ul>
                    </div>

                    {/* Raw Voice Features */}
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                        <h3 className="text-2xl font-semibold mb-4">
                            Raw Voice Features
                        </h3>
                        <ul className="space-y-4">
                            <li className="flex justify-between items-center">
                                <span className="text-gray-300">
                                    Pitch (F0):
                                </span>
                                <span className="text-xl font-mono">
                                    {analysis.voice.pitch.toFixed(2)} Hz
                                </span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="text-gray-300">
                                    Jitter (Stability):
                                </span>
                                <span className="text-xl font-mono">
                                    {analysis.voice.jitter.toFixed(4)}
                                </span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="text-gray-300">Loudness:</span>
                                <span className="text-xl font-mono">
                                    {analysis.voice.loudness.toFixed(2)}
                                </span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="text-gray-300">
                                    Harshness (Alpha Ratio):
                                </span>
                                <span className="text-xl font-mono">
                                    {analysis.voice.harshness.toFixed(2)}
                                </span>
                            </li>
                        </ul>
                    </div>
                    {/* Raw Video Features */}
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                        <h3 className="text-2xl font-semibold mb-4">
                            Raw Facial Features (Avg. Intensity)
                        </h3>
                        <ul className="space-y-4">
                            <li className="flex justify-between items-center">
                                <span className="text-gray-300">
                                    Smile (AU12):
                                </span>
                                <span className="text-xl font-mono">
                                    {analysis.video.smile.toFixed(2)}
                                </span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="text-gray-300">
                                    Brow Furrow (AU04):
                                </span>
                                <span className="text-xl font-mono">
                                    {analysis.video.browFurrow.toFixed(2)}
                                </span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="text-gray-300">
                                    Mouth Open (AU25):
                                </span>
                                <span className="text-xl font-mono">
                                    {analysis.video.mouthOpen.toFixed(2)}
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}

async function fetchAnalysisData(videoId: string, host: string | null) {
    // This fetch call is now happening on the server-side.
    // We need to provide the full URL.
    const protocol = host?.startsWith("localhost") ? "http" : "https";
    try {
        const response = await fetch(
            `${protocol}://${host}/api/results/${videoId}`
        );

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
    } catch (err: unknown) {
        return {
            analysis: null,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

export default async function ResultsPage({
    params,
}: {
    params: Promise<{ videoId: string }>;
}) {
    const { videoId } = await params;
    const requestHeaders = await headers();
    const host = requestHeaders.get("host");
    const { analysis, error } = await fetchAnalysisData(videoId, host);

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
