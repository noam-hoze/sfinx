import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

export interface BasicCandidateInput {
    name: string;
    email: string;
    image: string;
    jobTitle: string;
    location: string;
    bio: string;
    skills: string[];
}

export async function seedBasicCandidate(
    prisma: PrismaClient,
    input: BasicCandidateInput
) {
    // If user exists, ensure profile exists, then return existing user
    const existingUser = await prisma.user.findUnique({
        where: { email: input.email },
    });

    if (existingUser) {
        console.log(`✅ ${input.name} already exists. Skipping creation.`);
        const existingProfile = await prisma.candidateProfile.findUnique({
            where: { userId: existingUser.id },
        });
        if (!existingProfile) {
            await prisma.candidateProfile.create({
                data: {
                    userId: existingUser.id,
                    jobTitle: input.jobTitle,
                    location: input.location,
                    bio: input.bio,
                    skills: input.skills,
                },
            });
        }
        return existingUser;
    }

    const hashedPassword = await bcrypt.hash("sfinx", 12);

    const user = await prisma.user.create({
        data: {
            name: input.name,
            email: input.email,
            password: hashedPassword,
            role: UserRole.CANDIDATE,
            image: input.image,
        },
    });

    await prisma.candidateProfile.create({
        data: {
            userId: user.id,
            jobTitle: input.jobTitle,
            location: input.location,
            bio: input.bio,
            skills: input.skills,
        },
    });

    console.log(`✅ Created candidate: ${user.email}`);
    return user;
}

// Utility: fetch a job for a given companyId (e.g., "meta")
export async function getJobForCompany(
    prisma: PrismaClient,
    companyId: string
) {
    const job = await prisma.job.findFirst({ where: { companyId } });
    if (!job) {
        throw new Error(
            `No jobs found for companyId=${companyId}. Seed companies/jobs first.`
        );
    }
    return job;
}

// Utility: ensure an Application exists for a candidate and company
export async function ensureApplicationForCompany(
    prisma: PrismaClient,
    candidateId: string,
    companyId: string
) {
    const job = await getJobForCompany(prisma, companyId);
    // Upsert by the unique composite (candidateId, jobId)
    const application = await prisma.application.upsert({
        where: { candidateId_jobId: { candidateId, jobId: job.id } as any },
        update: { status: "INTERVIEWING" },
        create: {
            candidateId,
            jobId: job.id,
            status: "INTERVIEWING",
        },
    });
    return application;
}
