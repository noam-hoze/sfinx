import React, { useRef, useEffect, useState } from "react";

interface CollapsibleSectionProps {
    title: string;
    score?: number;
    isExpanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

export default function CollapsibleSection({
    title,
    score,
    isExpanded,
    onToggle,
    children,
}: CollapsibleSectionProps) {
    const contentRef = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState<number>(0);

    useEffect(() => {
        if (contentRef.current) {
            setHeight(isExpanded ? contentRef.current.scrollHeight : 0);
        }
    }, [isExpanded, children]);

    return (
        <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden">
            <button
                onClick={onToggle}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/40 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                        {title}
                        {score !== undefined && (
                            <span className="ml-2 text-blue-600">({score}%)</span>
                        )}
                    </span>
                </div>
                <svg
                    className={`w-5 h-5 text-gray-600 transition-transform duration-300 ${
                        isExpanded ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                    />
                </svg>
            </button>
            <div
                style={{ height: `${height}px` }}
                className="transition-all duration-300 ease-in-out overflow-hidden"
            >
                <div ref={contentRef} className="px-4 pb-4 pt-2 border-t border-white/20">
                    {children}
                </div>
            </div>
        </div>
    );
}

