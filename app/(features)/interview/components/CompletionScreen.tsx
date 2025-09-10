"use client";

import React from "react";

interface CompletionScreenProps {
    show: boolean;
    candidateName: string;
}

const CompletionScreen: React.FC<CompletionScreenProps> = ({
    show,
    candidateName,
}) => {
    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center bg-white transition-opacity duration-1000 ${
                show ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
        >
            <div className="text-center px-6">
                <div className="mb-8">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                        <svg
                            className="w-12 h-12 text-blue-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M5 13l4 4L19 7"
                            />
                        </svg>
                    </div>
                </div>
                <h1 className="text-4xl font-light text-gray-900 mb-4 tracking-tight">
                    {`Thank you for your time ${candidateName}`}
                </h1>
                <p className="text-xl text-gray-600 font-light">Good luck!</p>
            </div>
        </div>
    );
};

export default CompletionScreen;
