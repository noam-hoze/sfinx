import React, { useEffect, useState } from "react";

interface AutoFillModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (description: string, prompt?: string) => Promise<void>;
    isGenerating: boolean;
}

/**
 * Modal for entering job description prompt to auto-fill job fields.
 */
export default function AutoFillModal({
    isOpen,
    onClose,
    onGenerate,
    isGenerating,
}: AutoFillModalProps) {
    const [shouldRender, setShouldRender] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [description, setDescription] = useState("");
    const [prompt, setPrompt] = useState("");

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            setTimeout(() => setIsVisible(true), 10);
        } else {
            setIsVisible(false);
            const timer = setTimeout(() => setShouldRender(false), 150);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen && !isGenerating) {
                onClose();
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [isOpen, onClose, isGenerating]);

    const handleGenerate = async () => {
        const trimmed = description.trim();
        if (trimmed.length === 0) return;

        await onGenerate(trimmed, prompt.trim() || undefined);
        setDescription("");
        setPrompt("");
        onClose();
    };

    if (!shouldRender) return null;

    return (
        <div
            className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 transition-opacity ${
                isVisible ? "opacity-100 duration-300" : "opacity-0 duration-150"
            }`}
            onClick={!isGenerating ? onClose : undefined}
        >
            <div
                className={`bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col transform transition-all ${
                    isVisible
                        ? "scale-100 opacity-100 duration-300"
                        : "scale-95 opacity-0 duration-150"
                }`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Auto-fill from Prompt
                    </h2>
                    <button
                        onClick={onClose}
                        disabled={isGenerating}
                        className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Close modal"
                    >
                        <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Custom Instructions (Optional)
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Example: Read information from https://example.com/job-details and use it to generate the job description..."
                            className="w-full min-h-[100px] rounded-xl border border-gray-200 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none text-sm"
                            disabled={isGenerating}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Add custom instructions like fetching data from URLs or specific formatting requirements
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Job Description
                        </label>
                        <p className="text-sm text-gray-600 mb-2">
                            Describe the job position and requirements. AI will extract and generate all job fields, interview content, and evaluation categories.
                        </p>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Example: We're looking for a Senior Full-Stack Engineer with 5+ years of experience in React and Node.js. The role involves building scalable web applications, mentoring junior developers, and collaborating with product teams..."
                            className="w-full min-h-[240px] rounded-xl border border-gray-200 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
                            disabled={isGenerating}
                            autoFocus
                        />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <p className="text-xs text-gray-500">
                            {description.trim().length === 0
                                ? "Enter a job description to continue"
                                : "Only empty fields will be populated"}
                        </p>
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || description.trim().length === 0}
                            className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm hover:shadow-md"
                        >
                            {isGenerating ? (
                                <>
                                    <svg
                                        className="animate-spin h-4 w-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        />
                                    </svg>
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M13 10V3L4 14h7v7l9-11h-7z"
                                        />
                                    </svg>
                                    Generate
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
