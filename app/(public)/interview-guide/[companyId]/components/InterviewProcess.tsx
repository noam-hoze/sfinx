/**
 * Interview process timeline section — 4 stages displayed horizontally (desktop) / vertically (mobile).
 * Stage data comes from the database config; no hardcoded content.
 */
import type { InterviewStageConfig } from "app/shared/types/interviewGuide";

const STAGE_STYLES = [
    { color: "bg-blue-50 text-electric-blue border-blue-100", connector: "bg-blue-100" },
    { color: "bg-purple-50 text-purple-600 border-purple-100", connector: "bg-purple-100" },
    { color: "bg-amber-50 text-amber-600 border-amber-100", connector: "bg-amber-100" },
    { color: "bg-green-50 text-success-green border-green-100", connector: "bg-green-100" },
];

function StepIcon({ index }: { index: number }) {
    const icons = [
        <path key="0" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
        <path key="1" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />,
        <path key="2" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />,
        <path key="3" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />,
    ];
    return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">{icons[index]}</svg>;
}

function DesktopStage({ stage, index, isLast }: { stage: InterviewStageConfig; index: number; isLast: boolean }) {
    const style = STAGE_STYLES[index % STAGE_STYLES.length];
    return (
        <div className="flex items-start flex-1">
            <div className="flex flex-col items-center flex-1">
                <div className={`w-14 h-14 rounded-2xl border ${style.color} flex items-center justify-center mb-4 shadow-sm`}>
                    <StepIcon index={index} />
                </div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Step 0{index + 1}</span>
                <h3 className="text-base font-bold text-gray-900 mb-2 text-center">{stage.title}</h3>
                <p className="text-sm text-gray-500 text-center leading-relaxed max-w-44">{stage.shortDescription}</p>
            </div>
            {!isLast && (
                <div className="flex items-center mt-7 flex-shrink-0 w-8">
                    <div className={`h-0.5 w-full ${style.connector}`} />
                    <svg className="w-3 h-3 text-gray-300 flex-shrink-0 -ml-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                </div>
            )}
        </div>
    );
}

function MobileStage({ stage, index }: { stage: InterviewStageConfig; index: number }) {
    const style = STAGE_STYLES[index % STAGE_STYLES.length];
    return (
        <div className="flex gap-4 items-start">
            <div className={`w-12 h-12 rounded-xl border ${style.color} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                <StepIcon index={index} />
            </div>
            <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Step 0{index + 1}</span>
                <h3 className="text-base font-bold text-gray-900 mb-1">{stage.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{stage.shortDescription}</p>
            </div>
        </div>
    );
}

interface InterviewProcessProps {
    stages: InterviewStageConfig[];
}

export default function InterviewProcess({ stages }: InterviewProcessProps) {
    return (
        <section id="interview-process" className="bg-gray-50 py-20 px-6">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-14">
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Our interview process</h2>
                    <p className="text-lg text-gray-500 max-w-xl mx-auto">A step-by-step guide to our hiring process — built for transparency and your success.</p>
                </div>
                <div className="hidden md:flex items-start justify-between gap-0 mb-16">
                    {stages.map((stage, i) => <DesktopStage key={stage.title} stage={stage} index={i} isLast={i === stages.length - 1} />)}
                </div>
                <div className="md:hidden space-y-6 mb-16">
                    {stages.map((stage, i) => <MobileStage key={stage.title} stage={stage} index={i} />)}
                </div>
            </div>
        </section>
    );
}
