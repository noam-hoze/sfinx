import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "app/shared/services/auth";
import bcrypt from "bcryptjs";
import prisma from "lib/prisma";
import { log } from "app/shared/services";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.AUTH_API;

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const userId = (session?.user as any)?.id;

        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword) {
            return NextResponse.json(
                { error: "Both current password and new password are required." },
                { status: 400 }
            );
        }

        if (typeof newPassword !== "string" || newPassword.length < 6) {
            return NextResponse.json(
                { error: "New password must be at least 6 characters long." },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            return NextResponse.json(
                { error: "User not found." },
                { status: 404 }
            );
        }

        if (user.password) {
            const isPasswordValid = await bcrypt.compare(
                currentPassword,
                user.password
            );

            if (!isPasswordValid) {
                return NextResponse.json(
                    { error: "Current password is incorrect." },
                    { status: 400 }
                );
            }
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);

        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });

        log.info(LOG_CATEGORY, `Password updated successfully for user ${userId}`);

        return NextResponse.json({
            message: "Password updated successfully.",
        });
    } catch (error) {
        log.error(LOG_CATEGORY, "Error changing password:", error);
        return NextResponse.json(
            { error: "Failed to change password. Please try again." },
            { status: 500 }
        );
    }
}
