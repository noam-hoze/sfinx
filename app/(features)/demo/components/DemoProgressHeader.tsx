/**
 * Progress stepper component for demo flow.
 * Displays 5 stages with visual indicators for completed, current, and future stages.
 */

"use client";

interface DemoProgressHeaderProps {
    currentStage: 1 | 2 | 3 | 4 | 5;
}

const stages = [
    { number: 1, name: "Welcome" },
    { number: 2, name: "Interview" },
    { number: 3, name: "Company View" },
    { number: 4, name: "Report" },
    { number: 5, name: "Candidates" },
];

/**
 * Returns stage status based on current progress.
 */
function getStageStatus(
    stageNum: number,
    currentStage: number
): "completed" | "current" | "future" {
    if (stageNum < currentStage) return "completed";
    if (stageNum === currentStage) return "current";
    return "future";
}

export default function DemoProgressHeader({
    currentStage,
}: DemoProgressHeaderProps) {
    return (
        <div className="w-full bg-white border-b border-gray-200 py-8">
            <div className="max-w-4xl mx-auto px-4">
                <div className="flex items-center justify-between">
                    {stages.map((stage, index) => {
                        const status = getStageStatus(
                            stage.number,
                            currentStage
                        );
                        const isLast = index === stages.length - 1;

                        return (
                            <div key={stage.number} className="flex items-center flex-1">
                                <div className="flex flex-col items-center">
                                    {/* Stage Dot */}
                                    <div
                                        className={`
                                            flex items-center justify-center rounded-full transition-all
                                            ${
                                                status === "completed"
                                                    ? "w-10 h-10 bg-blue-600"
                                                    : status === "current"
                                                    ? "w-12 h-12 bg-blue-600"
                                                    : "w-10 h-10 bg-gray-300"
                                            }
                                        `}
                                    >
                                        {status === "completed" ? (
                                            <svg
                                                className="w-5 h-5 text-white"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={3}
                                                    d="M5 13l4 4L19 7"
                                                />
                                            </svg>
                                        ) : (
                                            <span
                                                className={`
                                                    text-sm font-semibold
                                                    ${
                                                        status === "current"
                                                            ? "text-white"
                                                            : "text-gray-500"
                                                    }
                                                `}
                                            >
                                                {stage.number}
                                            </span>
                                        )}
                                    </div>

                                    {/* Stage Name */}
                                    <span
                                        className={`
                                            mt-2 text-sm whitespace-nowrap
                                            ${
                                                status === "current"
                                                    ? "font-semibold text-blue-600"
                                                    : status === "completed"
                                                    ? "font-medium text-blue-600"
                                                    : "font-normal text-gray-500"
                                            }
                                        `}
                                    >
                                        {stage.name}
                                    </span>
                                </div>

                                {/* Connecting Line */}
                                {!isLast && (
                                    <div
                                        className={`
                                            flex-1 h-0.5 mx-4 mb-6
                                            ${
                                                status === "completed"
                                                    ? "bg-blue-600"
                                                    : "bg-gray-300"
                                            }
                                        `}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

