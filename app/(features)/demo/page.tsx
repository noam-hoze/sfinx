/**
 * Demo welcome page - Stage 1 of the demo flow.
 * Introduces the demo experience and provides CTA to start interview.
 */

"use client";

import { useRouter } from "next/navigation";
import DemoProgressHeader from "./components/DemoProgressHeader";

export default function DemoWelcomePage() {
    const router = useRouter();

    const handleStartInterview = () => {
        const jobId = "meta-frontend-engineer";
        const userId = "demo-candidate-user-id";
        const companyId = "meta";
        router.push(`/interview?demo=true&jobId=${jobId}&userId=${userId}&companyId=${companyId}`);
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <DemoProgressHeader currentStage={1} />

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

                    <button
                        onClick={handleStartInterview}
                        className="w-full bg-blue-600 text-white text-lg font-medium py-4 px-8 rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        Start Interview
                    </button>
                </div>
            </div>
        </div>
    );
}

