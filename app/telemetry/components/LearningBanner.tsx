import React from "react";

const LearningBanner = () => {
    return (
        <div
            className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-md relative mb-4"
            role="alert"
        >
            <strong className="font-bold">Learning Mode Active:</strong>
            <span className="block sm:inline">
                {" "}
                Candidate has navigated away from the IDE.
            </span>
        </div>
    );
};

export default LearningBanner;
