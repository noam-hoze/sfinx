import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "app/shared/services";
import { log } from "app/shared/services";

export async function POST(request: NextRequest) {
    try {
        const {
            name,
            email,
            password,
            role,
            companyName,
            companySize,
            jobTitle,
            location,
            bio,
        } = await request.json();

        if (!name || !email || !password || !role) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        // Validate role
        if (!["CANDIDATE", "COMPANY"].includes(role)) {
            return NextResponse.json(
                { error: "Invalid account type" },
                { status: 400 }
            );
        }

        // Additional validation for company accounts
        if (role === "COMPANY" && !companyName) {
            return NextResponse.json(
                { error: "Company name is required for company accounts" },
                { status: 400 }
            );
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return NextResponse.json(
                { error: "User already exists" },
                { status: 400 }
            );
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user and profile in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // Create the base user
            const user = await tx.user.create({
                data: {
                    name,
                    email,
                    password: hashedPassword,
                    role: role as "CANDIDATE" | "COMPANY",
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    createdAt: true,
                },
            });

            // Create the appropriate profile based on role
            if (role === "CANDIDATE") {
                await (tx as any).candidateProfile.create({
                    data: {
                        userId: user.id,
                        jobTitle,
                        location,
                        bio,
                    },
                });
            } else if (role === "COMPANY") {
                await (tx as any).companyProfile.create({
                    data: {
                        userId: user.id,
                        companyName: companyName!,
                        companySize: companySize as any,
                        location,
                        bio,
                    },
                });
            }

            return user;
        });

        return NextResponse.json(
            { message: "User created successfully", user: result },
            { status: 201 }
        );
    } catch (error) {
        log.error("Signup error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
