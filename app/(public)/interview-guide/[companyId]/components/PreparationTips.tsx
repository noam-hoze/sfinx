/**
 * Preparation tips grid section (dark background).
 * All tip content comes from the database config; no hardcoded copy.
 */
import type { PrepTipConfig } from "app/shared/types/interviewGuide";

/** Single tip card. */
function TipCard({ tip }: { tip: PrepTipConfig }) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors duration-200">
            <div className="w-10 h-10 rounded-xl bg-electric-blue/20 text-electric-blue flex items-center justify-center mb-4">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            </div>
            <h3 className="text-base font-bold text-white mb-2">{tip.title}</h3>
            <p className="text-sm text-gray-400 leading-relaxed mb-4">{tip.description}</p>
            {tip.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {tip.tags.map((tag) => (
                        <span key={tag} className="text-xs text-gray-500 bg-white/5 border border-white/10 rounded-full px-3 py-1">
                            {tag}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

interface PreparationTipsProps {
    tips: PrepTipConfig[];
}

export default function PreparationTips({ tips }: PreparationTipsProps) {
    return (
        <section className="bg-deep-slate py-20 px-6">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-14">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">How to prepare</h2>
                    <p className="text-lg text-gray-400 max-w-xl mx-auto">Practical tips to help you show up confident and prepared at every stage.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tips.map((tip) => <TipCard key={tip.title} tip={tip} />)}
                </div>
            </div>
        </section>
    );
}
