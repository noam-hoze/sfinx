import { Company, CompanyProfile } from "@prisma/client";
import { prisma } from "app/shared/services/prisma";
import { log } from "app/shared/services";

export interface CompanyContext {
    company: Company;
    profile: CompanyProfile;
}

/**
 * Resolves the company associated with a company user.
 */
export async function loadCompanyForUser(userId: string): Promise<CompanyContext> {
    const profile = await prisma.companyProfile.findUnique({
        where: { userId },
    });
    if (!profile) {
        log.warn("Company profile not found for user", { userId });
        throw new Error("Company profile not found for user");
    }

    const company = await prisma.company.findUnique({
        where: { name: profile.companyName },
    });
    if (!company) {
        log.warn("Company record not found for profile", {
            companyName: profile.companyName,
        });
        throw new Error("Company record not found for profile");
    }

    return { company, profile };
}

