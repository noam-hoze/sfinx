/**
 * Hero section of the interview guide landing page.
 * Displays company name, tagline, hero image, and CTA buttons.
 */
import type { InterviewGuideConfig } from "app/shared/types/interviewGuide";

interface HeroProps {
    companyName: string;
    companyLogo: string | null;
    website: string | null;
    careersUrl: string | undefined;
    config: InterviewGuideConfig["hero"];
}

/** Top navigation bar with company logo and website link. */
function NavBar({ companyName, companyLogo, website }: Pick<HeroProps, "companyName" | "companyLogo" | "website">) {
    return (
        <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
                {companyLogo ? (
                    <img src={companyLogo} alt={`${companyName} logo`} className="h-10 w-auto object-contain" />
                ) : (
                    <span className="text-xl font-bold text-gray-900">{companyName}</span>
                )}
            </div>
            {website && (
                <a href={website} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
                    {website.replace(/^https?:\/\//, "")}
                </a>
            )}
        </nav>
    );
}

/** Heading, tagline, and CTA buttons. */
function HeroContent({ companyName, tagline, careersUrl }: { companyName: string; tagline: string; careersUrl: string | undefined }) {
    return (
        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-24 text-center">
            <p className="text-sm font-semibold text-electric-blue uppercase tracking-widest mb-4">
                Hiring at {companyName}
            </p>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight mb-6">
                Interviewing at <span className="text-electric-blue">{companyName}</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">{tagline}</p>
            <div className="flex flex-wrap items-center justify-center gap-4">
                {careersUrl && (
                    <a href={careersUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-6 py-3 rounded-full bg-electric-blue text-white font-semibold text-sm hover:bg-blue-600 transition-all duration-200 shadow-md hover:shadow-lg">
                        View Open Roles
                    </a>
                )}
                <a href="#interview-process" className="inline-flex items-center px-6 py-3 rounded-full border border-gray-300 text-gray-700 font-semibold text-sm hover:border-gray-400 hover:bg-white/60 transition-all duration-200">
                    Learn about the process
                </a>
            </div>
        </div>
    );
}

/** Hero image from config URL. */
function HeroImage({ imageUrl, companyName }: { imageUrl: string; companyName: string }) {
    return (
        <div className="max-w-5xl mx-auto px-6 pb-0">
            <div className="relative rounded-t-2xl overflow-hidden shadow-2xl h-72 md:h-96">
                <img src={imageUrl} alt={`${companyName} team`} className="w-full h-full object-cover" />
            </div>
        </div>
    );
}

export default function Hero({ companyName, companyLogo, website, careersUrl, config }: HeroProps) {
    return (
        <section className="relative bg-gradient-to-br from-white via-blue-50 to-indigo-50 overflow-hidden">
            <NavBar companyName={companyName} companyLogo={companyLogo} website={website} />
            <HeroContent companyName={companyName} tagline={config.tagline} careersUrl={careersUrl} />
            <HeroImage imageUrl={config.imageUrl} companyName={companyName} />
        </section>
    );
}
