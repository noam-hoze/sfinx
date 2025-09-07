"use client";

import React from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Menu } from "@headlessui/react";

export default function Header() {
    const { data: session } = useSession();
    const router = useRouter();
    const pathname = usePathname();

    const noHeaderPaths = ["/", "/login", "/signup"];

    if (noHeaderPaths.includes(pathname)) {
        return null;
    }

    // Debug session data
    console.log("Header - Session user:", session?.user);
    console.log("Header - Session user image:", session?.user?.image);
    console.log(
        "Header - Image source:",
        session?.user?.image
            ? `${window.location.origin}${session.user.image}`
            : "No image"
    );

    const handleSignOut = async () => {
        await signOut({ callbackUrl: "/login" });
    };

    const settingsPath =
        (session?.user as any)?.role === "COMPANY"
            ? "/company-dashboard/settings"
            : "/settings";

    return (
        <header className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
                {/* Logo/Brand */}
                <Link href="/" className="flex items-center">
                    <Image
                        src="/logos/sfinx-logo.png"
                        alt="Sfinx Logo"
                        width={120}
                        height={120}
                        className="h-15 w-auto"
                    />
                </Link>

                {/* User Avatar and Menu */}
                <div className="flex items-center">
                    {session?.user && (
                        <Menu as="div" className="relative">
                            <Menu.Button className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden relative scale-150">
                                {session.user.image ? (
                                    <Image
                                        key={session.user.image} // Force re-render when image changes
                                        src={session.user.image}
                                        alt="Profile"
                                        fill
                                        sizes="32px"
                                        className="object-cover rounded-full"
                                    />
                                ) : (
                                    <span className="text-sm font-medium text-gray-700">
                                        {(session.user as any).name
                                            ?.charAt(0)
                                            ?.toUpperCase() ||
                                            (session.user as any).email
                                                ?.charAt(0)
                                                ?.toUpperCase()}
                                    </span>
                                )}
                            </Menu.Button>
                            <Menu.Items className="absolute left-1/2 -translate-x-1/2 mt-2 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none w-20 z-50">
                                <div className="px-1 py-1 ">
                                    <Menu.Item>
                                        {({ active }) => (
                                            <Link
                                                href={settingsPath}
                                                className={`${
                                                    active ? "bg-gray-100" : ""
                                                } text-gray-900 group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                                            >
                                                Settings
                                            </Link>
                                        )}
                                    </Menu.Item>
                                </div>
                                <div className="px-1 py-1">
                                    <Menu.Item>
                                        {({ active }) => (
                                            <button
                                                onClick={handleSignOut}
                                                className={`${
                                                    active ? "bg-gray-100" : ""
                                                } text-gray-900 group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                                            >
                                                Sign out
                                            </button>
                                        )}
                                    </Menu.Item>
                                </div>
                            </Menu.Items>
                        </Menu>
                    )}
                </div>
            </div>
        </header>
    );
}
