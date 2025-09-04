"use client";

import { useRef } from "react";
import HeyGenInterview, {
    HeyGenInterviewRef,
} from "../interview/components/chat/HeyGenInterview";

export default function HeyGenInterviewTestPage() {
    const heyGenRef = useRef<HeyGenInterviewRef>(null);

    const handleStartInterview = async () => {
        try {
            await heyGenRef.current?.startInterview();
            console.log("✅ Interview started");
        } catch (error) {
            console.error("❌ Failed to start interview:", error);
        }
    };

    const handleSpeakGreeting = async () => {
        try {
            await heyGenRef.current?.speakText(
                "Hi Noam, how are you today? Are you feeling well or what?"
            );
            console.log("✅ Greeting spoken");
        } catch (error) {
            console.error("❌ Failed to speak greeting:", error);
        }
    };

    const handleStopInterview = async () => {
        try {
            await heyGenRef.current?.stopInterview();
            console.log("✅ Interview stopped");
        } catch (error) {
            console.error("❌ Failed to stop interview:", error);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">
                HeyGen Interview Component Test
            </h1>

            {/* Control Buttons */}
            <div className="mb-6 flex gap-4 flex-wrap">
                <button
                    onClick={handleStartInterview}
                    className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition-colors"
                >
                    Start Interview
                </button>

                <button
                    onClick={handleSpeakGreeting}
                    className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg transition-colors"
                >
                    Speak Greeting
                </button>

                <button
                    onClick={handleStopInterview}
                    className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition-colors"
                >
                    Stop Interview
                </button>
            </div>

            {/* HeyGen Interview Component */}
            <div className="border-2 border-gray-300 rounded-lg p-4">
                <h2 className="text-xl font-semibold mb-4">
                    HeyGen Interview Component
                </h2>
                <HeyGenInterview
                    ref={heyGenRef}
                    onVideoReady={() => console.log("🎥 Video is ready")}
                    onSpeakingStart={() => console.log("🎤 Speaking started")}
                    onSpeakingEnd={() => console.log("🔇 Speaking ended")}
                />
            </div>

            {/* Instructions */}
            <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h3 className="text-lg font-semibold mb-2">
                    Test Instructions:
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>
                        Click "Start Interview" to initialize the HeyGen avatar
                        session
                    </li>
                    <li>
                        Wait for video to appear and status to show "Ready for
                        conversation"
                    </li>
                    <li>
                        Click "Speak Greeting" to hear: "Hi Noam, how are you
                        today? Are you feeling well or what?"
                    </li>
                    <li>Click "Stop Interview" to end the session</li>
                    <li>Check browser console for detailed logs</li>
                </ol>
            </div>
        </div>
    );
}
