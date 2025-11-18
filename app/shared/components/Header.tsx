"use client";

import React from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import { Menu } from "@headlessui/react";
import { log } from "../services";
import SfinxLogo from "./SfinxLogo";
import DemoProgressHeader from "../../../app/(features)/demo/components/DemoProgressHeader";

const logger = log;

export default function Header() {
    const { data: session } = useSession();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const isDemoMode = searchParams.get("demo") === "true" || pathname?.startsWith("/demo") || pathname?.startsWith("/background-interview");

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


    const handleSignOut = async () => {
        await signOut({ callbackUrl: "/login" });
    };

    const role = (session?.user as any)?.role;
    const settingsPath = role === "COMPANY" ? "/company-dashboard/settings" : "/settings";

    // Get current demo stage based on pathname
    const getDemoStage = (): 1 | 2 | 3 | 4 | 5 | 6 | null => {
        if (!isDemoMode) return null;
        if (pathname === "/background-interview") {
            // Check if we're on the welcome screen or in the interview
            const urlParams = new URLSearchParams(window.location.search);
            const stage = urlParams.get("stage");
            return stage === "interview" ? 2 : 1;
        }
        if (pathname === "/interview") return 3;
        if (pathname === "/demo/company-view") return 4;
        if (pathname === "/cps") return 5;
        if (pathname === "/demo/ranked-candidates") return 6;
        return null;
    };

    const demoStage = getDemoStage();

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

                {/* Center: Demo Breadcrumbs or Primary Navigation */}
                {demoStage ? (
                    <div className="flex justify-center">
                        <DemoProgressHeader currentStage={demoStage} />
                    </div>
                ) : (
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
                    {role === "COMPANY" && (
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
                                Candidates
                            </Link>
                            <Link
                                ref={(el) => {
                                    linkRefs.current["/company-dashboard/jobs"] = el;
                                }}
                                href="/company-dashboard/jobs"
                                className={`${linkStyles} ${
                                    pathname === "/company-dashboard/jobs"
                                        ? activeLinkStyles
                                        : inactiveLinkStyles
                                }`}
                            >
                                Jobs
                            </Link>
                        </>
                    )}
                    {role === "CANDIDATE" && (
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
                    </nav>
                )}

                {/* Sliding indicator (only for non-demo mode) */}
                {!demoStage && (
                    <div
                        className="absolute bottom-0 left-0 h-[1px] bg-blue-700 transition-all duration-300 ease-in-out"
                        style={{
                            width: indicatorStyle.width,
                            left: indicatorStyle.left,
                        }}
                    />
                )}

                {/* User Avatar and Menu / Demo Restart Button */}
                <div className="flex items-center justify-end gap-4">
                    {isDemoMode && (
                        <button
                            onClick={() => {
                                window.location.href = '/background-interview?jobId=meta-frontend-engineer&companyId=meta';
                            }}
                            className="px-4 py-2 text-sm font-medium text-sfinx-purple border border-sfinx-purple rounded-lg hover:bg-sfinx-purple hover:text-white transition-all"
                        >
                            Restart Demo
                        </button>
                    )}
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
