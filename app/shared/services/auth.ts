import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { log } from "./logger";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
let authDebugLogPath: string | undefined;

/**
 * Appends Google auth diagnostics to a file for later inspection.
 */
async function appendAuthDebugLog(entry: Record<string, unknown>) {
    if (typeof window !== "undefined" || process.env.NEXT_RUNTIME === "edge") {
        return;
    }

    try {
        const fsModule = await import("fs/promises");
        const pathModule = await import("path");
        const fs = (fsModule as any).default ?? fsModule;
        const path = (pathModule as any).default ?? pathModule;

        if (!authDebugLogPath) {
            authDebugLogPath = path.join(
                process.cwd(),
                ".next",
                "cache",
                "auth-logs",
                "google-auth.log"
            );
        }

        await fs.mkdir(path.dirname(authDebugLogPath), { recursive: true });
        await fs.appendFile(
            authDebugLogPath,
            `${new Date().toISOString()} ${JSON.stringify(entry)}\n`
        );
    } catch (error) {
        log.error("Failed to append auth debug log", { error });
    }
}

/**
 * Creates the Google OAuth provider using environment configuration.
 */
function createGoogleProvider() {
    if (!googleClientId || !googleClientSecret) {
        log.error("Missing Google OAuth configuration", {
            provider: "google",
            hasClientId: Boolean(googleClientId),
            hasClientSecret: Boolean(googleClientSecret),
        });
        throw new Error(
            "Google OAuth requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
        );
    }

    log.info("Google OAuth provider configured", { provider: "google" });

    return GoogleProvider({
        clientId: googleClientId,
        clientSecret: googleClientSecret,
    });
}

const providers: NextAuthOptions["providers"] = [
    CredentialsProvider({
        name: "credentials",
        credentials: {
            email: { label: "Email", type: "email" },
            password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
            if (!credentials?.email || !credentials?.password) {
                return null;
            }

            const user = await prisma.user.findUnique({
                where: {
                    email: credentials.email,
                },
            });

            if (!user || !user.password) {
                return null;
            }

            const isPasswordValid = await bcrypt.compare(
                credentials.password,
                user.password
            );

            if (!isPasswordValid) {
                return null;
            }

            return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                image: user.image,
            } as any;
        },
    }),
];

if (typeof window === "undefined" && process.env.NEXT_RUNTIME !== "edge") {
    providers.unshift(createGoogleProvider());
}

/**
 * Configures NextAuth authentication options and providers.
 */
export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),
    providers,
    session: {
        strategy: "jwt",
    },
    callbacks: {
        async signIn({ user, account, profile, email }) {
            await appendAuthDebugLog({
                stage: "callbacks.signIn",
                provider: account?.provider,
                type: account?.type,
                userId: user?.id,
                email: email?.email,
                hasError: Boolean((account as any)?.error),
            });
            return true;
        },
        async jwt({ token, user, trigger, session }) {
            log.info("JWT callback triggered:", { user, trigger, session });
            if (user) {
                token.role = (user as any).role;
                token.image = (user as any).image;
                log.info("JWT token updated with image:", token.image);
            }
            // Handle session update
            if (trigger === "update" && session?.image) {
                token.image = session.image;
                log.info(
                    "JWT token updated via session update:",
                    token.image
                );
            }
            return token;
        },
        async session({ session, token }) {
            log.info("Session callback triggered with token:", {
                sub: token.sub,
                role: token.role,
                image: token.image,
            });
            if (session.user) {
                (session.user as any).id = token.sub!;
                (session.user as any).role = token.role as string;
                (session.user as any).image = token.image as string;
                log.info(
                    "Session updated with image:",
                    (session.user as any).image
                );
            }
            return session;
        },
        async redirect({ url, baseUrl }) {
            // Redirect based on user role after login
            if (url.startsWith("/")) return `${baseUrl}${url}`;
            // If the url is external, return it
            else if (new URL(url).origin === baseUrl) return url;
            return baseUrl;
        },
    },
    events: {
        async signIn(message) {
            await appendAuthDebugLog({
                stage: "events.signIn",
                provider: message.account?.provider,
                type: message.account?.type,
                userId: message.user?.id,
            });
        },
        async signOut(message) {
            await appendAuthDebugLog({
                stage: "events.signOut",
                userId: message.token?.sub,
            });
        },
        async error(error) {
            await appendAuthDebugLog({
                stage: "events.error",
                name: error.name,
                message: error.message,
            });
        },
    },
    pages: {
        signIn: "/login",
    },
};
