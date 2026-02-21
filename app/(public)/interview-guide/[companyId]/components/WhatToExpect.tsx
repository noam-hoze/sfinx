"use client";

import { useState } from "react";

const STAGES = [
    {
        id: "screening",
        label: "AI Screening",
        badge: "Stage 1",
        badgeColor: "bg-blue-100 text-electric-blue",
        duration: "~30 minutes",
        format: "Voice conversation (no video)",
        who: "Sfinx AI interviewer",
        description:
            "The first step is an AI-powered screening interview conducted by Sfinx. This removes scheduling friction and gives you a relaxed, consistent experience regardless of the time zone. You'll answer technical and behavioral questions through a voice conversation.",
        whatToExpect: [
            "Questions about your professional background and experience",
            "A technical challenge relevant to the role",
            "Behavioral questions using structured prompts",
            "No video — just your voice and focus",
        ],
        howToPrepare: [
            "Review your resume and be ready to discuss specific projects",
            "Prepare a quiet space with a stable internet connection",
            "Use the S.T.A.R. framework for behavioral questions",
            "Have your development environment ready for coding challenges",
        ],
    },
    {
        id: "first",
        label: "First Interview",
        badge: "Stage 2",
        badgeColor: "bg-purple-100 text-purple-700",
        duration: "45–60 minutes",
        format: "Video call",
        who: "Hiring manager + team member",
        description:
            "If your screening goes well, you'll meet 1–2 team members over video. This conversation goes deeper into your experience and explores how you'd work day-to-day. It's a two-way conversation — come with questions too.",
        whatToExpect: [
            "Deeper exploration of your technical background",
            "Discussion of past projects and their impact",
            "Culture and working-style questions",
            "A chance for you to ask questions about the role and team",
        ],
        howToPrepare: [
            "Review the job description and align your experience to the role",
            "Prepare 2–3 examples of past work you're proud of",
            "Research the company's product, market, and recent news",
            "Prepare thoughtful questions for the interviewers",
        ],
    },
    {
        id: "second",
        label: "Second Interview",
        badge: "Stage 3",
        badgeColor: "bg-amber-100 text-amber-700",
        duration: "60 minutes",
        format: "Video call or take-home review",
        who: "Senior leadership or cross-functional team",
        description:
            "The second interview is a deeper dive. You may work through a case study, present a take-home assignment, or have an extended technical session. This stage is designed to assess your depth and how you think through complex problems.",
        whatToExpect: [
            "Technical deep-dive or case study walkthrough",
            "Discussion of a take-home assignment (if assigned)",
            "Cross-functional collaboration scenarios",
            "Clarifying questions on experience gaps or specifics",
        ],
        howToPrepare: [
            "Thoroughly complete any take-home assignments (quality over speed)",
            "Be ready to walk through your reasoning, not just your answers",
            "Brush up on system design or domain-specific concepts",
            "Think about trade-offs and be ready to defend your decisions",
        ],
    },
    {
        id: "ceo",
        label: "CEO Conversation",
        badge: "Stage 4",
        badgeColor: "bg-green-100 text-success-green",
        duration: "~30 minutes",
        format: "Video call",
        who: "CEO / Founder",
        description:
            "The final stage is a conversation with the CEO or a senior company leader. This is about mutual alignment — understanding if you share the company's vision, values, and long-term direction. It's informal, honest, and important.",
        whatToExpect: [
            "Open conversation about the company's mission and direction",
            "Questions about your career goals and long-term ambitions",
            "A genuine discussion about culture fit and values alignment",
            "Opportunity to ask the CEO anything on your mind",
        ],
        howToPrepare: [
            "Read about the company's founding story and mission",
            "Know your own career motivations and where you want to grow",
            "Prepare big-picture questions about company vision",
            "Be yourself — this is as much about you evaluating them",
        ],
    },
];

export default function WhatToExpect() {
    const [activeStage, setActiveStage] = useState(0);
    const stage = STAGES[activeStage];

    return (
        <section className="bg-white py-20 px-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                        What to expect
                    </h2>
                    <p className="text-lg text-gray-500 max-w-xl mx-auto">
                        Select a stage to learn exactly what happens and how to prepare.
                    </p>
                </div>

                {/* Tab navigation */}
                <div className="flex flex-wrap gap-2 justify-center mb-10">
                    {STAGES.map((s, i) => (
                        <button
                            key={s.id}
                            onClick={() => setActiveStage(i)}
                            className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 border ${
                                activeStage === i
                                    ? "bg-deep-slate text-white border-deep-slate shadow-sm"
                                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                            }`}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>

                {/* Stage content */}
                <div className="bg-gray-50 rounded-2xl p-8 md:p-12 border border-gray-100">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        {/* Left: overview */}
                        <div>
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 ${stage.badgeColor}`}>
                                {stage.badge}
                            </span>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">{stage.label}</h3>
                            <p className="text-gray-500 leading-relaxed mb-6">{stage.description}</p>

                            {/* Meta */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 text-sm">
                                    <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center shadow-sm flex-shrink-0">
                                        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <span className="text-gray-600"><strong className="text-gray-800">Duration:</strong> {stage.duration}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                    <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center shadow-sm flex-shrink-0">
                                        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <span className="text-gray-600"><strong className="text-gray-800">Format:</strong> {stage.format}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                    <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center shadow-sm flex-shrink-0">
                                        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                    <span className="text-gray-600"><strong className="text-gray-800">With:</strong> {stage.who}</span>
                                </div>
                            </div>
                        </div>

                        {/* Right: what to expect + how to prepare */}
                        <div className="space-y-8">
                            <div>
                                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4">What to expect</h4>
                                <ul className="space-y-3">
                                    {stage.whatToExpect.map((item) => (
                                        <li key={item} className="flex items-start gap-3 text-sm text-gray-600">
                                            <span className="mt-1 w-4 h-4 rounded-full bg-electric-blue/10 flex items-center justify-center flex-shrink-0">
                                                <svg className="w-2.5 h-2.5 text-electric-blue" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            </span>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4">How to prepare</h4>
                                <ul className="space-y-3">
                                    {stage.howToPrepare.map((item) => (
                                        <li key={item} className="flex items-start gap-3 text-sm text-gray-600">
                                            <span className="mt-1 w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                                <svg className="w-2.5 h-2.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            </span>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
