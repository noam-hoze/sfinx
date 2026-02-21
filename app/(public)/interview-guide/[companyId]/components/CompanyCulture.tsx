/**
 * Company culture section: About, What We Look For, Mission & Values.
 * All text comes from the database — no fallbacks.
 */
import type { InterviewGuideConfig } from "app/shared/types/interviewGuide";

interface CompanyCultureProps {
    companyName: string;
    description: string | null;
    cultureTags: string[];
    industry: string;
    locations: string[];
    config: InterviewGuideConfig["culture"];
}

function AboutCard({ companyName, description }: { companyName: string; description: string | null }) {
    return (
        <div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-electric-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-3">About {companyName}</h3>
            {description && <p className="text-gray-600 text-sm leading-relaxed">{description}</p>}
        </div>
    );
}

function WhatWeLookFor({ cultureTags }: { cultureTags: string[] }) {
    return (
        <div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-3">What we look for</h3>
            <ul className="space-y-2">
                {cultureTags.map((tag) => (
                    <li key={tag} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-electric-blue flex-shrink-0" />
                        {tag}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function MissionCard({ industry, locations, missionText }: { industry: string; locations: string[]; missionText: string }) {
    return (
        <div>
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-success-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-3">Mission &amp; values</h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-3">{missionText}</p>
            {locations.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                    {locations.map((loc) => (
                        <span key={loc} className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-full px-3 py-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {loc}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function CompanyCulture({ companyName, description, cultureTags, industry, locations, config }: CompanyCultureProps) {
    return (
        <section className="bg-white py-20 px-6">
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10">
                <AboutCard companyName={companyName} description={description} />
                <WhatWeLookFor cultureTags={cultureTags} />
                <MissionCard industry={industry} locations={locations} missionText={config.missionText} />
            </div>
        </section>
    );
}
