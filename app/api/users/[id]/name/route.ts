import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "app/shared/services/auth";
import { log } from "app/shared/services";

const prisma = new PrismaClient();

type RouteContext = {
    params: Promise<{ id: string }>;
};

/**
 * PATCH user name.
 * Supports skip-auth for demo mode.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        const url = new URL(request.url);
        const skipAuth = url.searchParams.get("skip-auth") === "true";

        if (!skipAuth) {
            const session = await getServerSession(authOptions);
            if (!session?.user) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
        }

        const { id: userId } = await context.params;
        const body = await request.json();
        const { name } = body;

        if (!name || typeof name !== "string" || name.trim().length === 0) {
            return NextResponse.json(
                { error: "Valid name is required" },
                { status: 400 }
            );
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { name: name.trim() },
        });

        log.info(`Updated user ${userId} name to: ${name.trim()}`);

        return NextResponse.json({
            success: true,
            name: updatedUser.name,
        });
    } catch (error) {
        log.error("Error updating user name:", error);
        return NextResponse.json(
            { error: "Failed to update user name" },
            { status: 500 }
        );
    }
}
