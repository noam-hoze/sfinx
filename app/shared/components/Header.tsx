"use client";

import React from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import { Menu } from "@headlessui/react";
import { logger } from "../services";
import SfinxLogo from "./SfinxLogo";

export default function Header() {
    const { data: session } = useSession();
    const router = useRouter();
    const pathname = usePathname();

    // Sliding indicator state
    const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, left: 0 });
    const navRef = useRef<HTMLElement>(null);
    const linkRefs = useRef<{ [key: string]: HTMLAnchorElement | null }>({});

    const linkStyles =
        "text-base font-medium transition-all duration-200 ease-in-out rounded-lg px-4 py-2 transform";
    const activeLinkStyles = "text-blue-700 scale-110";
    const inactiveLinkStyles = "text-gray-500 hover:text-gray-900";

    // Function to update indicator position
    const updateIndicator = useCallback(() => {
        if (!navRef.current) return;

        const navRect = navRef.current.getBoundingClientRect();
        const headerRect = navRef.current
            .closest("header")
            ?.getBoundingClientRect();

        if (!headerRect) return;

        const activeLink = Object.values(linkRefs.current).find((link) => {
            if (!link) return false;
            return link.classList.contains("text-blue-700"); // Check for active class
        });

        if (activeLink) {
            const linkRect = activeLink.getBoundingClientRect();
            setIndicatorStyle({
                width: linkRect.width,
                left: linkRect.left - headerRect.left,
            });
        }
    }, []);

    const noHeaderPaths = ["/", "/login", "/signup"];

    // Update indicator on pathname change or mount
    useEffect(() => {
        // Small delay to ensure DOM is ready
        const timer = setTimeout(updateIndicator, 100);
        return () => clearTimeout(timer);
    }, [pathname, updateIndicator]);

    if (noHeaderPaths.includes(pathname)) {
        return null;
    }

    // Debug session data (optional logging)
    logger.info("Header - Session user:", session?.user);
    logger.info("Header - Session user image:", session?.user?.image);
    logger.info(
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
        <header className="bg-white border-b border-gray-200 px-4 py-4 relative">
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-64">
                {/* Logo/Brand */}
                <Link href="/" className="flex items-center">
                    <SfinxLogo
                        width={120}
                        height={40}
                        className="w-[120px] h-auto"
                    />
                </Link>

                {/* Primary Navigation (role-based) */}
                <nav
                    ref={navRef}
                    className="flex items-center gap-24 justify-start relative"
                >
                    {/* {(session?.user as any)?.role === "COMPANY" && (
                        <Link
                            ref={(el) => {
                                linkRefs.current["/company-dashboard"] = el;
                            }}
                            href="/company-dashboard"
                            className={`${linkStyles} ${
                                pathname === "/company-dashboard"
                                    ? activeLinkStyles
                                    : inactiveLinkStyles
                            }`}
                        >
                            Dashboard
                        </Link>
                    )} */}
                    {(session?.user as any)?.role === "CANDIDATE" && (
                        <>
                            <Link
                                ref={(el) => {
                                    linkRefs.current["/job-search"] = el;
                                }}
                                href="/job-search"
                                className={`${linkStyles} ${
                                    pathname === "/job-search"
                                        ? activeLinkStyles
                                        : inactiveLinkStyles
                                }`}
                            >
                                Jobs
                            </Link>
                            <Link
                                ref={(el) => {
                                    linkRefs.current["/practice"] = el;
                                }}
                                href="/practice"
                                className={`${linkStyles} ${
                                    pathname === "/practice"
                                        ? activeLinkStyles
                                        : inactiveLinkStyles
                                }`}
                            >
                                Practice
                            </Link>
                            <Link
                                ref={(el) => {
                                    linkRefs.current["/mentors"] = el;
                                }}
                                href="/mentors"
                                className={`${linkStyles} ${
                                    pathname === "/mentors"
                                        ? activeLinkStyles
                                        : inactiveLinkStyles
                                }`}
                            >
                                Mentors
                            </Link>
                        </>
                    )}
                    {(session?.user as any)?.role === "COMPANY" && (
                        <>
                            <Link
                                ref={(el) => {
                                    linkRefs.current["/company-dashboard"] = el;
                                }}
                                href="/company-dashboard"
                                className={`${linkStyles} ${
                                    pathname === "/company-dashboard"
                                        ? activeLinkStyles
                                        : inactiveLinkStyles
                                }`}
                            >
                                Dashboard
                            </Link>
                            <Link
                                ref={(el) => {
                                    linkRefs.current["/interview/training"] =
                                        el;
                                }}
                                href="/interview/training"
                                className={`${linkStyles} ${
                                    pathname === "/interview/training"
                                        ? activeLinkStyles
                                        : inactiveLinkStyles
                                }`}
                            >
                                Training
                            </Link>
                        </>
                    )}
                </nav>

                {/* Sliding indicator */}
                <div
                    className="absolute bottom-0 left-0 h-[1px] bg-blue-700 transition-all duration-300 ease-in-out"
                    style={{
                        width: indicatorStyle.width,
                        left: indicatorStyle.left,
                    }}
                />

                {/* User Avatar and Menu */}
                <div className="flex items-center justify-end">
                    {session?.user && (
                        <Menu as="div" className="relative">
                            <Menu.Button className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden relative">
                                {session.user.image ? (
                                    <Image
                                        key={session.user.image} // Force re-render when image changes
                                        src={session.user.image}
                                        alt="Profile"
                                        fill
                                        sizes="48px"
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
