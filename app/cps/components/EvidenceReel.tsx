"use client";

interface EvidenceReelProps {
    chapters?: any[]; // Keep for compatibility but not used
    evidence?: any[]; // Keep for compatibility but not used
    jumpToTime?: number; // Keep for compatibility but not used
    onChapterClick?: (timestamp: number) => void; // Keep for compatibility but not used
    videoUrl?: string | null;
}

const EvidenceReel: React.FC<EvidenceReelProps> = ({ videoUrl }) => {
    if (!videoUrl) {
        return (
            <div className="bg-white rounded-xl shadow-xl border border-gray-300 overflow-hidden">
                <div className="aspect-video bg-gray-900 flex items-center justify-center">
                    <div className="text-center text-white">
                        <div className="w-16 h-16 mx-auto mb-4 bg-gray-700 rounded-full flex items-center justify-center">
                            <svg
                                className="w-8 h-8 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                            </svg>
                        </div>
                        <p className="text-lg font-medium text-gray-300">
                            No Video Available
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                            This candidate hasn't completed an interview yet
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-xl border border-gray-300 overflow-hidden">
            <video
                className="w-full aspect-video object-cover"
                controls
                preload="metadata"
                playsInline
            >
                <source src={videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
            </video>
        </div>
    );
};

export default EvidenceReel;
