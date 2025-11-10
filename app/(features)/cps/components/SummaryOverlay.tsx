"use client";

import React, { useState, useEffect } from "react";

interface Evidence {
    question: string;
    answerExcerpt: string;
    reasoning: string;
}

interface TraitSummary {
    score: number;
    text: string;
    evidence?: Evidence[];
}

interface SummaryOverlayProps {
    executiveSummary: string;
    recommendation?: string;
    adaptability: TraitSummary;
    creativity: TraitSummary;
    reasoning: TraitSummary;
}

const getScoreColor = (score: number): string => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-blue-500";
    if (score >= 40) return "bg-yellow-500";
    return "bg-red-500";
};

const getScoreBadge = (score: number): string => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Needs Improvement";
};

const SummaryOverlay: React.FC<SummaryOverlayProps> = ({
    executiveSummary,
    recommendation,
    adaptability,
    creativity,
    reasoning,
}) => {
    const [currentSlide, setCurrentSlide] = useState(0);

    const traits = [
        { name: "Adaptability", key: "adaptability", data: adaptability },
        { name: "Creativity", key: "creativity", data: creativity },
        { name: "Reasoning", key: "reasoning", data: reasoning },
    ];

    const totalSlides = 4; // 1 executive + 3 traits

    const nextSlide = () => {
        setCurrentSlide((prev) => Math.min(prev + 1, totalSlides - 1));
    };

    const prevSlide = () => {
        setCurrentSlide((prev) => Math.max(prev - 1, 0));
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft") prevSlide();
            if (e.key === "ArrowRight") nextSlide();
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Render Slide 0: Executive Summary
    const renderExecutiveSummary = () => (
        <div className="space-y-4 md:space-y-6">
            <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 md:mb-4">
                    Executive Summary
                </h2>
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap text-base leading-relaxed">
                    {executiveSummary}
                </div>
            </div>
            {recommendation && (
                <div className="pt-4 border-t border-gray-300">
                    <p className="text-sm font-semibold text-gray-600 mb-2">
                        Recommendation
                    </p>
                    <p className="text-lg font-medium text-gray-900">
                        {recommendation}
                    </p>
                </div>
            )}
        </div>
    );

    // Render Trait Slide
    const renderTraitSlide = (trait: typeof traits[0]) => (
        <div className="space-y-4 md:space-y-6">
            {/* Trait Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-2xl md:text-3xl font-bold text-gray-900">
                    {trait.name}
                </h3>
                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-600">
                        {getScoreBadge(trait.data.score)}
                    </span>
                    <div
                        className={`h-10 w-10 rounded-full ${getScoreColor(
                            trait.data.score
                        )} flex items-center justify-center text-white font-bold text-base`}
                    >
                        {trait.data.score}
                    </div>
                </div>
            </div>

            {/* Assessment Text */}
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap text-base leading-relaxed">
                {trait.data.text}
            </div>

            {/* Evidence Section */}
            {trait.data.evidence && trait.data.evidence.length > 0 && (
                <div className="pt-4 border-t border-gray-300">
                    <h4 className="text-sm font-semibold text-gray-600 mb-3">
                        Supporting Evidence
                    </h4>
                    <div className="space-y-4">
                        {trait.data.evidence.map((ev, idx) => (
                            <div
                                key={idx}
                                className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                            >
                                <p className="text-sm font-medium text-gray-900 mb-2">
                                    <span className="text-gray-500">Q:</span>{" "}
                                    {ev.question}
                                </p>
                                <p className="text-sm text-gray-700 mb-2 italic border-l-2 border-blue-400 pl-3">
                                    &quot;{ev.answerExcerpt}&quot;
                                </p>
                                <p className="text-xs text-gray-600">
                                    <span className="font-medium">
                                        Analysis:
                                    </span>{" "}
                                    {ev.reasoning}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="absolute inset-0 bg-white z-10 flex items-center justify-center p-4 md:p-8">
            {/* Main Content Container */}
            <div className="relative w-full max-w-3xl h-full flex flex-col">
                {/* Slide Content */}
                <div className="flex-1 overflow-y-auto py-4 md:py-8">
                    {currentSlide === 0 && renderExecutiveSummary()}
                    {currentSlide === 1 && renderTraitSlide(traits[0])}
                    {currentSlide === 2 && renderTraitSlide(traits[1])}
                    {currentSlide === 3 && renderTraitSlide(traits[2])}
                </div>

                {/* Navigation Controls */}
                <div className="flex items-center justify-between pt-4 md:pt-6 border-t border-gray-300">
                    {/* Previous Button */}
                    <button
                        onClick={prevSlide}
                        disabled={currentSlide === 0}
                        className={`px-3 md:px-6 py-2 md:py-3 rounded-lg text-sm md:text-base font-medium transition-all ${
                            currentSlide === 0
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-blue-500 text-white hover:bg-blue-600"
                        }`}
                    >
                        <span className="hidden md:inline">← Previous</span>
                        <span className="md:hidden">←</span>
                    </button>

                    {/* Slide Indicator */}
                    <div className="text-gray-600 text-sm md:text-base font-medium">
                        {currentSlide + 1} / {totalSlides}
                    </div>

                    {/* Next Button */}
                    <button
                        onClick={nextSlide}
                        disabled={currentSlide === totalSlides - 1}
                        className={`px-3 md:px-6 py-2 md:py-3 rounded-lg text-sm md:text-base font-medium transition-all ${
                            currentSlide === totalSlides - 1
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-blue-500 text-white hover:bg-blue-600"
                        }`}
                    >
                        <span className="hidden md:inline">Next →</span>
                        <span className="md:hidden">→</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SummaryOverlay;
