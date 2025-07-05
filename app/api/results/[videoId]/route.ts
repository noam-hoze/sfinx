import { NextResponse } from "next/server";

export async function GET(
    request: Request,
    { params }: { params: { videoId: string } }
) {
    const videoId = params.videoId;

    // In a real application, you would use the videoId to find the
    // corresponding analysis file from OpenFace.
    // For now, we'll return mock data.

    console.log(`Fetching analysis for videoId: ${videoId}`);

    // Simulate a processing delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const mockAnalysisData = {
        au_time_series: {
            AU12: [0, 0.1, 0.5, 1.2, 0.8, 0.3, 0],
            AU04: [0, 0, 0, 0.2, 0.3, 0.1, 0],
        },
        gaze_vectors: [], // Placeholder
        head_pose: [], // Placeholder
        summary: {
            engagement: 0.78,
            stress_level: 0.34,
            smile_frequency: 2.5,
        },
    };

    return NextResponse.json(mockAnalysisData);
}
