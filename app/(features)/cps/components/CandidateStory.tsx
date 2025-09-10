import React from "react";
import { CandidateProfile } from "../../../shared/contexts";
import PersistenceFlow from "./PersistenceFlow";
import LearningToActionTimeline from "./LearningToActionTimeline";
import ConfidenceBuildingCurve from "./ConfidenceBuildingCurve";

interface CandidateStoryProps {
    candidate: CandidateProfile;
    onVideoJump: (timestamp: number) => void;
}

const CandidateStory: React.FC<CandidateStoryProps> = ({
    candidate,
    onVideoJump,
}) => {
    const getConfidenceColor = (confidence: string) => {
        switch (confidence) {
            case "High":
                return "text-green-600 bg-green-50 border-green-200";
            case "Medium":
                return "text-yellow-600 bg-yellow-50 border-yellow-200";
            case "Low":
                return "text-red-600 bg-red-50 border-red-200";
            default:
                return "text-gray-600 bg-gray-50 border-gray-200";
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-2">
            {/* Header Section with Name, Score, Confidence */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-3">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {candidate.name.charAt(0)}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {candidate.name}
                        </h1>
                        <p className="text-gray-600">Candidate Profile Story</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600 mb-1">
                            {candidate.matchScore}%
                        </div>
                        <div className="text-sm text-gray-600 font-medium">
                            MatchScore
                        </div>
                    </div>

                    <div
                        className={`inline-block px-4 py-2 rounded-full border text-sm font-semibold ${getConfidenceColor(
                            candidate.confidence
                        )}`}
                    >
                        {candidate.confidence} Confidence
                    </div>
                </div>
            </div>

            {/* Behavioral Graphs Section */}
            <div className="border-t border-gray-100 pt-3">
                <div className="flex items-center gap-2 mb-3">
                    <h2 className="text-base font-semibold text-gray-900">
                        Behavior
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <PersistenceFlow onVideoJump={onVideoJump} />
                    <LearningToActionTimeline onVideoJump={onVideoJump} />
                    <ConfidenceBuildingCurve onVideoJump={onVideoJump} />
                </div>
            </div>
        </div>
    );
};

export default CandidateStory;
