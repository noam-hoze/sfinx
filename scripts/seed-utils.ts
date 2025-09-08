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
