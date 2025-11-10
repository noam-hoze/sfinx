/**
 * Demo welcome page - Stage 1 of the demo flow.
 * Introduces the demo experience and provides CTA to start interview.
 */

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DemoWelcomePage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleStartInterview = async () => {
        if (!name.trim()) {
            alert("Please enter your name");
            return;
        }

        setIsLoading(true);
        try {
            const userId = "demo-candidate-user-id";
            
            // Update user name in DB
            const response = await fetch(`/api/users/${userId}/name?skip-auth=true`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim() }),
            });

            if (!response.ok) {
                throw new Error("Failed to update name");
            }

            // Navigate to interview
            const jobId = "meta-frontend-engineer";
            const companyId = "meta";
            router.push(`/interview?demo=true&jobId=${jobId}&userId=${userId}&companyId=${companyId}`);
        } catch (error) {
            console.error("Error updating name:", error);
            alert("Failed to update name. Please try again.");
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-3xl mx-auto px-4 py-16">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12">
                    <h1 className="text-4xl font-semibold text-gray-900 mb-6">
                        Welcome to Sfinx Demo
                    </h1>

                    <p className="text-lg text-gray-700 mb-8 leading-relaxed">
                        Experience our AI-powered interview platform from both perspectives:
                        first as a candidate completing an interview, then as a hiring manager
                        reviewing results and comparing candidates.
                    </p>

                    <div className="bg-blue-50 rounded-xl p-6 mb-8">
                        <h2 className="text-xl font-medium text-gray-900 mb-4">
                            What you'll experience:
                        </h2>
                        <ul className="space-y-3 text-gray-700">
                            <li className="flex items-start">
                                <span className="text-blue-600 mr-3">1.</span>
                                <span>Complete a technical interview for Frontend Engineer at Meta</span>
                            </li>
                            <li className="flex items-start">
                                <span className="text-blue-600 mr-3">2.</span>
                                <span>View your comprehensive interview analysis report</span>
                            </li>
                            <li className="flex items-start">
                                <span className="text-blue-600 mr-3">3.</span>
                                <span>See how you rank among other candidates</span>
                            </li>
                        </ul>
                    </div>

                    <div className="mb-6">
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                            Your Name
                        </label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && name.trim() && !isLoading) {
                                    handleStartInterview();
                                }
                            }}
                            placeholder="Enter your full name"
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            disabled={isLoading}
                        />
                    </div>

                    <button
                        onClick={handleStartInterview}
                        disabled={isLoading || !name.trim()}
                        className="w-full bg-blue-600 text-white text-lg font-medium py-4 px-8 rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {isLoading ? "Starting..." : "Continue to Interview"}
                    </button>
                </div>
            </div>
        </div>
    );
}

