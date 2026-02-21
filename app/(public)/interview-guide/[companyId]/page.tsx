/**
 * Public interview guide landing page for a specific company.
 * Returns 404 if company not found or config not yet published.
 */
import { notFound } from "next/navigation";
import { Metadata } from "next";
import prisma from "lib/prisma";
import type { InterviewGuideConfig } from "app/shared/types/interviewGuide";
import Hero from "./components/Hero";
import CompanyCulture from "./components/CompanyCulture";
import InterviewProcess from "./components/InterviewProcess";
import WhatToExpect from "./components/WhatToExpect";
import PreparationTips from "./components/PreparationTips";
import FooterCTA from "./components/FooterCTA";

interface PageProps {
    params: Promise<{ companyId: string }>;
}

/** Fetches company by ID or returns null. */
async function fetchCompany(companyId: string) {
    return prisma.company.findUnique({ where: { id: companyId } });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { companyId } = await params;
    const company = await fetchCompany(companyId);
    if (!company) return { title: "Interview Guide" };
    return {
        title: `Interviewing at ${company.name} | Interview Guide`,
        description: `Learn about the hiring process at ${company.name} and how to prepare for your interviews.`,
    };
}

export default async function InterviewGuidePage({ params }: PageProps) {
    const { companyId } = await params;
    const company = await fetchCompany(companyId);

    if (!company) notFound();

    const config = company.interviewGuideConfig as InterviewGuideConfig | null;
    if (!config) notFound();

    return (
        <main className="min-h-screen font-sans">
            <Hero companyName={company.name} companyLogo={company.logo} website={company.website} careersUrl={config.careersUrl} config={config.hero} />
            <CompanyCulture companyName={company.name} description={company.description} cultureTags={company.cultureTags} industry={company.industry} locations={company.locations} config={config.culture} />
            <InterviewProcess stages={config.stages} />
            <WhatToExpect stages={config.stages} />
            <PreparationTips tips={config.tips} />
            <FooterCTA companyName={company.name} website={company.website} careersUrl={config.careersUrl} />
        </main>
    );
}
