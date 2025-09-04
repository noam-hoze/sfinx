import React from "react";
import LearningBanner from "./LearningBanner";

const CandidateSession = () => {
    const isLearning = true; // Mock state for showing the banner

    return (
        <div className="bg-[#FAFAFA] min-h-screen p-8 font-sans">
            <header className="mb-8">
                <h1 className="text-4xl font-bold text-[#1C1C1E]">
                    Candidate Session
                </h1>
                <p className="text-gray-600">
                    Live analysis of a candidate&apos;s work session.
                </p>
            </header>

            {isLearning && <LearningBanner />}
        </div>
    );
};

export default CandidateSession;
