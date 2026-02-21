/**
 * "What to expect" tabbed section — one tab per interview stage.
 * All content comes from the config; no hardcoded copy.
 */
"use client";

import { useState } from "react";
import type { InterviewStageConfig } from "app/shared/types/interviewGuide";

const BADGE_STYLES = [
    "bg-blue-100 text-electric-blue",
    "bg-purple-100 text-purple-700",
    "bg-amber-100 text-amber-700",
    "bg-green-100 text-success-green",
];

function TabBar({ stages, activeIndex, onSelect }: { stages: InterviewStageConfig[]; activeIndex: number; onSelect: (i: number) => void }) {
    return (
        <div className="flex flex-wrap gap-2 justify-center mb-10">
            {stages.map((s, i) => (
                <button key={s.title} onClick={() => onSelect(i)}
                    className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 border ${activeIndex === i ? "bg-deep-slate text-white border-deep-slate shadow-sm" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}>
                    {s.title}
                </button>
            ))}
        </div>
    );
}

function StageMeta({ stage }: { stage: InterviewStageConfig }) {
    const rows = [
        { icon: "clock", label: "Duration", value: stage.duration },
        { icon: "video", label: "Format", value: stage.format },
        { icon: "user", label: "With", value: stage.who },
    ];
    return (
        <div className="space-y-3 mt-6">
            {rows.map(({ label, value }) => (
                <div key={label} className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center shadow-sm flex-shrink-0">
                        <span className="text-xs text-gray-400 font-bold">{label[0]}</span>
                    </div>
                    <span className="text-gray-600"><strong className="text-gray-800">{label}:</strong> {value}</span>
                </div>
            ))}
        </div>
    );
}

function BulletList({ items, accent }: { items: string[]; accent: "blue" | "amber" }) {
    const iconClass = accent === "blue" ? "bg-electric-blue/10 text-electric-blue" : "bg-amber-100 text-amber-600";
    return (
        <ul className="space-y-3">
            {items.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-gray-600">
                    <span className={`mt-1 w-4 h-4 rounded-full ${iconClass} flex items-center justify-center flex-shrink-0`}>
                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                    </span>
                    {item}
                </li>
            ))}
        </ul>
    );
}

function StagePanel({ stage, index }: { stage: InterviewStageConfig; index: number }) {
    return (
        <div className="bg-gray-50 rounded-2xl p-8 md:p-12 border border-gray-100">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 ${BADGE_STYLES[index % BADGE_STYLES.length]}`}>Stage {index + 1}</span>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{stage.title}</h3>
                    <p className="text-gray-500 leading-relaxed">{stage.description}</p>
                    <StageMeta stage={stage} />
                </div>
                <div className="space-y-8">
                    <div>
                        <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4">What to expect</h4>
                        <BulletList items={stage.whatToExpect} accent="blue" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4">How to prepare</h4>
                        <BulletList items={stage.howToPrepare} accent="amber" />
                    </div>
                </div>
            </div>
        </div>
    );
}

interface WhatToExpectProps {
    stages: InterviewStageConfig[];
}

export default function WhatToExpect({ stages }: WhatToExpectProps) {
    const [activeIndex, setActiveIndex] = useState(0);
    return (
        <section className="bg-white py-20 px-6">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">What to expect</h2>
                    <p className="text-lg text-gray-500 max-w-xl mx-auto">Select a stage to learn exactly what happens and how to prepare.</p>
                </div>
                <TabBar stages={stages} activeIndex={activeIndex} onSelect={setActiveIndex} />
                <StagePanel stage={stages[activeIndex]} index={activeIndex} />
            </div>
        </section>
    );
}
