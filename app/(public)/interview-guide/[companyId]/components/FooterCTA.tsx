interface FooterCTAProps {
    companyName: string;
    website?: string | null;
    careersUrl?: string;
}

export default function FooterCTA({ companyName, website, careersUrl }: FooterCTAProps) {
    return (
        <footer className="bg-gradient-to-br from-gray-900 to-deep-slate py-20 px-6">
            <div className="max-w-4xl mx-auto text-center">
                {/* CTA */}
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                    Ready to join {companyName}?
                </h2>
                <p className="text-lg text-gray-400 max-w-xl mx-auto mb-10">
                    Explore open positions and take the next step in your career. We&apos;re
                    excited to meet you.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4">
                    {careersUrl && (
                        <a
                            href={careersUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-8 py-3.5 rounded-full bg-electric-blue text-white font-semibold hover:bg-blue-600 transition-all duration-200 shadow-lg hover:shadow-xl"
                        >
                            View open roles
                            <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                        </a>
                    )}
                    {website && (
                        <a
                            href={website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-8 py-3.5 rounded-full border border-white/20 text-white font-semibold hover:bg-white/10 transition-all duration-200"
                        >
                            Learn about {companyName}
                        </a>
                    )}
                </div>

                {/* Divider */}
                <div className="mt-16 pt-10 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
                    <p>
                        Powered by{" "}
                        <span className="text-gray-400 font-semibold">Sfinx</span>
                        {" "}— AI-powered technical screening
                    </p>
                    <p>
                        &copy; {new Date().getFullYear()} {companyName}. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    );
}
