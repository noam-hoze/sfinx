import { notFound } from "next/navigation";
import { Metadata } from "next";
import prisma from "lib/prisma";
import Hero from "./components/Hero";
import CompanyCulture from "./components/CompanyCulture";
import InterviewProcess from "./components/InterviewProcess";
import WhatToExpect from "./components/WhatToExpect";
import PreparationTips from "./components/PreparationTips";
import FooterCTA from "./components/FooterCTA";

interface PageProps {
    params: Promise<{ companyId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { companyId } = await params;
    const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true },
    });

    if (!company) {
        return { title: "Interview Guide" };
    }

    return {
        title: `Interviewing at ${company.name} | Interview Guide`,
        description: `Learn about the hiring process at ${company.name} and how to prepare for your interviews.`,
    };
}

export default async function InterviewGuidePage({ params }: PageProps) {
    const { companyId } = await params;
    const company = await prisma.company.findUnique({
        where: { id: companyId },
    });

    if (!company) {
        notFound();
    }

    return (
        <main className="min-h-screen font-sans">
            <Hero
                companyName={company.name}
                companyLogo={company.logo}
                website={company.website}
            />
            <CompanyCulture
                companyName={company.name}
                description={company.description}
                cultureTags={company.cultureTags}
                industry={company.industry}
                locations={company.locations}
            />
            <InterviewProcess />
            <WhatToExpect />
            <PreparationTips />
            <FooterCTA companyName={company.name} website={company.website} />
        </main>
    );
}
