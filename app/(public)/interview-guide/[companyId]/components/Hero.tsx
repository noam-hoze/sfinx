interface HeroProps {
    companyName: string;
    companyLogo?: string | null;
    website?: string | null;
}

export default function Hero({ companyName, companyLogo, website }: HeroProps) {
    return (
        <section className="relative bg-gradient-to-br from-white via-blue-50 to-indigo-50 overflow-hidden">
            {/* Top nav bar */}
            <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto">
                <div className="flex items-center gap-3">
                    {companyLogo ? (
                        <img
                            src={companyLogo}
                            alt={`${companyName} logo`}
                            className="h-8 w-auto object-contain"
                        />
                    ) : (
                        <span className="text-xl font-bold text-gray-900">{companyName}</span>
                    )}
                </div>
                {website && (
                    <a
                        href={website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
                    >
                        {website.replace(/^https?:\/\//, "")}
                    </a>
                )}
            </nav>

            {/* Hero content */}
            <div className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-24 text-center">
                <p className="text-sm font-semibold text-electric-blue uppercase tracking-widest mb-4">
                    Hiring at {companyName}
                </p>
                <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight mb-6">
                    Interviewing at{" "}
                    <span className="text-electric-blue">{companyName}</span>
                </h1>
                <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
                    Start your journey with confidence. Explore our hiring process and learn
                    how to prepare for each stage — from the AI screening to your final conversation.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4">
                    <a
                        href="/job-search"
                        className="inline-flex items-center px-6 py-3 rounded-full bg-electric-blue text-white font-semibold text-sm hover:bg-blue-600 transition-all duration-200 shadow-md hover:shadow-lg"
                    >
                        View Open Roles
                    </a>
                    <a
                        href="#interview-process"
                        className="inline-flex items-center px-6 py-3 rounded-full border border-gray-300 text-gray-700 font-semibold text-sm hover:border-gray-400 hover:bg-white/60 transition-all duration-200"
                    >
                        Learn about the process
                    </a>
                </div>
            </div>

            {/* Hero image placeholder */}
            <div className="max-w-5xl mx-auto px-6 pb-0">
                <div className="relative rounded-t-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-gray-100 to-gray-200 h-72 md:h-96 flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-16 h-16 rounded-2xl bg-white/60 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 shadow-sm">
                            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <p className="text-sm text-gray-400 font-medium">{companyName} Team</p>
                    </div>
                </div>
            </div>
        </section>
    );
}
