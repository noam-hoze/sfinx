import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),
    providers: [
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
    ],
    session: {
        strategy: "jwt",
    },
    callbacks: {
        async jwt({ token, user, trigger, session }) {
            console.log("JWT callback triggered:", { user, trigger, session });
            if (user) {
                token.role = (user as any).role;
                token.image = (user as any).image;
                console.log("JWT token updated with image:", token.image);
            }
            // Handle session update
            if (trigger === "update" && session?.image) {
                token.image = session.image;
                console.log(
                    "JWT token updated via session update:",
                    token.image
                );
            }
            return token;
        },
        async session({ session, token }) {
            console.log("Session callback triggered with token:", {
                sub: token.sub,
                role: token.role,
                image: token.image,
            });
            if (session.user) {
                (session.user as any).id = token.sub!;
                (session.user as any).role = token.role as string;
                (session.user as any).image = token.image as string;
                console.log(
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
    pages: {
        signIn: "/login",
    },
};
