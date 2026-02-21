"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { Menu } from "@headlessui/react";
import { motion, AnimatePresence } from "framer-motion";
import SfinxLogo from "./SfinxLogo";
import { getActiveNavItem } from "../config/navigation";

const springWidth = { type: "spring", stiffness: 300, damping: 30, mass: 0.8 } as const;
const springPill  = { type: "spring", stiffness: 400, damping: 35 } as const;

export default function Sidebar() {
    const { data: session } = useSession();
    const router = useRouter();
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [menuButtonRef, setMenuButtonRef] = useState<HTMLElement | null>(null);

    const role = (session?.user as any)?.role;
    const activeNavPath = getActiveNavItem(pathname, role === "COMPANY" ? "COMPANY" : "CANDIDATE");

    const noSidebarPaths = ["/", "/login", "/signup", "/interview"];

    if (noSidebarPaths.includes(pathname) || pathname.startsWith("/interview-guide")) {
        return null;
    }

    const handleSignOut = async () => {
        await signOut({ callbackUrl: "/login" });
    };

    const settingsPath = role === "COMPANY" ? "/company-dashboard/settings" : "/settings";

    const navItems = role === "COMPANY"
        ? [
            { href: "/company-dashboard", label: "Applicants", icon: "users" },
            { href: "/company-dashboard/jobs", label: "Jobs", icon: "briefcase" },
            { href: "/company-dashboard/interview-guide", label: "Interview Guide", icon: "link" },
        ]
        : [
            { href: "/job-search", label: "Jobs", icon: "briefcase" },
        ];

    return (
        <motion.aside
            className="hidden md:flex glass-sidebar flex-col h-screen sticky top-0 z-40 overflow-hidden"
            animate={{ width: isCollapsed ? 80 : 256 }}
            transition={springWidth}
        >
            {/* Header with Logo and Toggle */}
            <div className="px-4 py-6 border-b border-white/30 flex items-center justify-between gap-2 flex-shrink-0">
                <AnimatePresence>
                    {!isCollapsed && (
                        <motion.div
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -8 }}
                            transition={{ duration: 0.15 }}
                            className="flex-1 overflow-hidden"
                        >
                            <Link href="/" className="flex items-center">
                                <SfinxLogo
                                    width={100}
                                    height={32}
                                    className="w-[100px] h-auto"
                                />
                            </Link>
                        </motion.div>
                    )}
                </AnimatePresence>
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-2 hover:bg-white/50 rounded-squircle-sm transition-colors text-gray-500 hover:text-gray-900 flex-shrink-0"
                    title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    <motion.svg
                        className="w-5 h-5"
                        animate={{ rotate: isCollapsed ? 180 : 0 }}
                        transition={springPill}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </motion.svg>
                </button>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                    const isActive = activeNavPath === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`relative flex items-center ${isCollapsed ? "justify-center" : "gap-3"} px-3 py-2.5 rounded-squircle-sm overflow-hidden transition-colors duration-150 ${
                                isActive
                                    ? "text-white"
                                    : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
                            }`}
                            title={isCollapsed ? item.label : undefined}
                        >
                            {/* Spring sliding active pill */}
                            {isActive && (
                                <motion.div
                                    layoutId="sidebar-active-pill"
                                    className="absolute inset-0 bg-sfinx-purple rounded-squircle-sm"
                                    transition={springPill}
                                />
                            )}

                            {/* Icon */}
                            <span className="relative z-10 flex-shrink-0">
                                {item.icon === "users" && (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-2a6 6 0 0112 0v2zm0 0h6v-2a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                )}
                                {item.icon === "briefcase" && (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                    </svg>
                                )}
                                {item.icon === "link" && (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                )}
                            </span>

                            {/* Label */}
                            <AnimatePresence>
                                {!isCollapsed && (
                                    <motion.span
                                        className="relative z-10 text-sm font-medium whitespace-nowrap"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.1 }}
                                    >
                                        {item.label}
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </Link>
                    );
                })}
            </nav>

            {/* Create New Job Button (Company Only) */}
            {role === "COMPANY" && (
                <div className="px-3 py-4 border-t border-white/30 flex-shrink-0">
                    <motion.button
                        type="button"
                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-squircle-sm bg-sfinx-purple text-white font-medium text-sm overflow-hidden"
                        onClick={() => router.push("/company-dashboard/jobs/new")}
                        title={isCollapsed ? "Create New Job" : undefined}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    >
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <AnimatePresence>
                            {!isCollapsed && (
                                <motion.span
                                    initial={{ opacity: 0, width: 0 }}
                                    animate={{ opacity: 1, width: "auto" }}
                                    exit={{ opacity: 0, width: 0 }}
                                    transition={{ duration: 0.15 }}
                                    className="overflow-hidden whitespace-nowrap"
                                >
                                    New Job
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </motion.button>
                </div>
            )}

            {/* User Profile Section */}
            {session?.user && (
                <div className="px-3 py-4 border-t border-white/30 flex-shrink-0">
                    <Menu as="div" className="relative">
                        {({ open }) => (
                            <>
                                {/* Backdrop overlay */}
                                {typeof window !== "undefined" && createPortal(
                                    <div
                                        className={`fixed inset-0 bg-black/30 backdrop-blur-[2px] transition-all duration-300 ease-in-out ${
                                            open ? "opacity-100" : "opacity-0 pointer-events-none"
                                        }`}
                                        style={{ zIndex: 50 }}
                                        aria-hidden="true"
                                    />,
                                    document.body
                                )}

                                <Menu.Button
                                    ref={setMenuButtonRef}
                                    className="w-full flex items-center gap-3 hover:bg-white/50 rounded-squircle-sm p-2 transition-colors cursor-pointer"
                                >
                                    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden relative flex-shrink-0">
                                        {session.user.image ? (
                                            <Image
                                                src={session.user.image}
                                                alt="Profile"
                                                fill
                                                sizes="40px"
                                                className="object-cover"
                                            />
                                        ) : (
                                            <span className="text-sm font-medium text-gray-700">
                                                {(session.user as any).name?.charAt(0)?.toUpperCase() ||
                                                    (session.user as any).email?.charAt(0)?.toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <AnimatePresence>
                                        {!isCollapsed && (
                                            <motion.div
                                                className="flex-1 min-w-0 text-left"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.1 }}
                                            >
                                                <p className="text-xs font-semibold text-gray-900 truncate">
                                                    {(session.user as any).name || "User"}
                                                </p>
                                                <p className="text-xs text-gray-500 truncate">
                                                    {(session.user as any).email}
                                                </p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </Menu.Button>

                                {/* Portal menu */}
                                {typeof window !== "undefined" && menuButtonRef && createPortal(
                                    <div style={{
                                        position: "fixed",
                                        bottom: window.innerHeight - menuButtonRef.getBoundingClientRect().top + 8,
                                        left: menuButtonRef.getBoundingClientRect().left,
                                        zIndex: 100,
                                    }}>
                                        <Menu.Items className="rounded-squircle bg-white/90 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 focus:outline-none w-72 overflow-hidden">
                                            {/* User Info */}
                                            <div className="px-4 py-4 border-b border-gray-100">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center overflow-hidden relative flex-shrink-0">
                                                        {session.user.image ? (
                                                            <Image
                                                                src={session.user.image}
                                                                alt="Profile"
                                                                fill
                                                                sizes="40px"
                                                                className="object-cover"
                                                            />
                                                        ) : (
                                                            <span className="text-sm font-semibold text-white">
                                                                {(session.user as any).name?.charAt(0)?.toUpperCase() || (session.user as any).email?.charAt(0)?.toUpperCase()}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-gray-900 truncate">
                                                            {(session.user as any).name || "User"}
                                                        </p>
                                                        <p className="text-xs text-gray-500 truncate">
                                                            {(session.user as any).email}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Menu Items */}
                                            <div className="py-2">
                                                <Menu.Item>
                                                    {({ active }) => (
                                                        <Link
                                                            href={settingsPath}
                                                            className={`${
                                                                active ? "bg-violet-50" : ""
                                                            } group flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors duration-150`}
                                                        >
                                                            <svg className="w-5 h-5 text-gray-400 group-hover:text-sfinx-purple transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            </svg>
                                                            <span>Settings</span>
                                                        </Link>
                                                    )}
                                                </Menu.Item>

                                                <Menu.Item>
                                                    {({ active }) => (
                                                        <button
                                                            onClick={handleSignOut}
                                                            className={`${
                                                                active ? "bg-red-50" : ""
                                                            } group flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors duration-150 w-full cursor-pointer`}
                                                        >
                                                            <svg className="w-5 h-5 text-gray-400 group-hover:text-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                                            </svg>
                                                            <span className="group-hover:text-red-600 transition-colors">Sign out</span>
                                                        </button>
                                                    )}
                                                </Menu.Item>
                                            </div>
                                        </Menu.Items>
                                    </div>,
                                    document.body
                                )}
                            </>
                        )}
                    </Menu>
                </div>
            )}
        </motion.aside>
    );
}
