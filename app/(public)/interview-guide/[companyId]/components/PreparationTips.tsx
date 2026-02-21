const TIPS = [
    {
        icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
        ),
        title: "Use the S.T.A.R. Framework",
        description:
            "For behavioral questions, structure your answers as Situation, Task, Action, Result. This keeps your responses clear, concise, and compelling.",
        tags: ["Behavioral", "Storytelling"],
    },
    {
        icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
        ),
        title: "Prepare for the AI interview",
        description:
            "Our AI screening is designed to be fair and thorough. Speak clearly, take your time, and treat it like a real conversation. The AI evaluates content, not confidence tricks.",
        tags: ["AI Screening", "Technical"],
    },
    {
        icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
        ),
        title: "Research the company",
        description:
            "Know the product, the mission, and recent company news. Being informed signals genuine interest and gives you great conversation fodder in every stage.",
        tags: ["All stages", "Culture"],
    },
    {
        icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
        ),
        title: "Come with great questions",
        description:
            "Your questions reveal as much about you as your answers. Ask about team dynamics, technical stack, growth trajectory, and how success is measured in the role.",
        tags: ["All stages", "Curiosity"],
    },
    {
        icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
        ),
        title: "Review your past work",
        description:
            "Pick 3–5 projects or experiences you're proud of and can speak to in detail — including challenges, your specific contribution, and measurable outcomes.",
        tags: ["Preparation", "Experience"],
    },
    {
        icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
        ),
        title: "Show your thinking process",
        description:
            "Great candidates don't just give the right answer — they show how they got there. Think out loud, ask clarifying questions, and demonstrate structured reasoning.",
        tags: ["Technical", "Problem-solving"],
    },
];

export default function PreparationTips() {
    return (
        <section className="bg-deep-slate py-20 px-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-14">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                        How to prepare
                    </h2>
                    <p className="text-lg text-gray-400 max-w-xl mx-auto">
                        Practical tips to help you show up confident and prepared at every stage.
                    </p>
                </div>

                {/* Tips grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {TIPS.map((tip) => (
                        <div
                            key={tip.title}
                            className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors duration-200"
                        >
                            <div className="w-10 h-10 rounded-xl bg-electric-blue/20 text-electric-blue flex items-center justify-center mb-4">
                                {tip.icon}
                            </div>
                            <h3 className="text-base font-bold text-white mb-2">{tip.title}</h3>
                            <p className="text-sm text-gray-400 leading-relaxed mb-4">{tip.description}</p>
                            <div className="flex flex-wrap gap-2">
                                {tip.tags.map((tag) => (
                                    <span
                                        key={tag}
                                        className="text-xs text-gray-500 bg-white/5 border border-white/10 rounded-full px-3 py-1"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
