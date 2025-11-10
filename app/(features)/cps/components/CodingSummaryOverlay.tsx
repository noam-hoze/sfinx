"use client";

import React, { useState, useEffect } from "react";

interface MetricSummary {
    score: number;
    text: string;
}

interface CodingSummaryOverlayProps {
    executiveSummary: string;
    recommendation?: string;
    codeQuality: MetricSummary;
    problemSolving: MetricSummary;
    independence: MetricSummary;
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

const CodingSummaryOverlay: React.FC<CodingSummaryOverlayProps> = ({
    executiveSummary,
    recommendation,
    codeQuality,
    problemSolving,
    independence,
}) => {
    const [currentSlide, setCurrentSlide] = useState(0);

    const metrics = [
        { name: "Code Quality", key: "codeQuality", data: codeQuality },
        { name: "Problem Solving", key: "problemSolving", data: problemSolving },
        { name: "Independence", key: "independence", data: independence },
    ];

    const totalSlides = 4; // 1 executive + 3 metrics

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
                    Coding Session Summary
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

    // Render Metric Slide
    const renderMetricSlide = (metric: typeof metrics[0]) => (
        <div className="space-y-4 md:space-y-6">
            {/* Metric Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-2xl md:text-3xl font-bold text-gray-900">
                    {metric.name}
                </h3>
                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-600">
                        {getScoreBadge(metric.data.score)}
                    </span>
                    <div
                        className={`h-10 w-10 rounded-full ${getScoreColor(
                            metric.data.score
                        )} flex items-center justify-center text-white font-bold text-base`}
                    >
                        {metric.data.score}
                    </div>
                </div>
            </div>

            {/* Assessment Text */}
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap text-base leading-relaxed">
                {metric.data.text}
            </div>
        </div>
    );

    return (
        <div className="absolute inset-0 bg-white z-10 flex items-center justify-center p-4 md:p-8">
            {/* Main Content Container */}
            <div className="relative w-full max-w-3xl h-full flex flex-col">
                {/* Slide Content */}
                <div className="flex-1 overflow-y-auto py-4 md:py-8">
                    {currentSlide === 0 && renderExecutiveSummary()}
                    {currentSlide === 1 && renderMetricSlide(metrics[0])}
                    {currentSlide === 2 && renderMetricSlide(metrics[1])}
                    {currentSlide === 3 && renderMetricSlide(metrics[2])}
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

export default CodingSummaryOverlay;

