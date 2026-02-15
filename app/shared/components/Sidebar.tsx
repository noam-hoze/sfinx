"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { Menu } from "@headlessui/react";
import SfinxLogo from "./SfinxLogo";
import { getActiveNavItem } from "../config/navigation";

export default function Sidebar() {
    const { data: session } = useSession();
    const router = useRouter();
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = useState(() => {
        if (typeof window === "undefined") return false;
        const saved = localStorage.getItem("sidebarCollapsed");
        return saved ? JSON.parse(saved) : false;
    });
    const [menuButtonRef, setMenuButtonRef] = useState<HTMLElement | null>(null);

    useEffect(() => {
        localStorage.setItem("sidebarCollapsed", JSON.stringify(isCollapsed));
    }, [isCollapsed]);

    const role = (session?.user as any)?.role;
    const activeNavPath = getActiveNavItem(pathname, role === "COMPANY" ? "COMPANY" : "CANDIDATE");

    const noSidebarPaths = ["/", "/login", "/signup", "/interview"];

    if (noSidebarPaths.includes(pathname)) {
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
        ]
        : [
            { href: "/job-search", label: "Jobs", icon: "briefcase" },
        ];

    return (
        <aside className={`hidden md:flex bg-white border-r border-gray-200 flex-col transition-all duration-300 ease-in-out ${
            isCollapsed ? 'w-20' : 'w-64'
        } h-screen sticky top-0 z-40 ${
            pathname === '/interview' ? '-translate-x-full' : 'translate-x-0'
        }`}>
            {/* Header with Logo and Toggle */}
            <div className="px-4 py-6 border-b border-gray-200 flex items-center justify-between gap-2">
                {!isCollapsed && (
                    <Link href="/" className="flex items-center flex-1">
                        <SfinxLogo
                            width={100}
                            height={32}
                            className="w-[100px] h-auto"
                        />
                    </Link>
                )}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-900 flex-shrink-0"
                    title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    <svg className={`w-5 h-5 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
                {navItems.map((item) => {
                    const isActive = activeNavPath === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg transition-all duration-200 ${
                                isActive
                                    ? "bg-sfinx-purple text-white shadow-md"
                                    : "text-gray-700 hover:bg-gray-100"
                            }`}
                            title={isCollapsed ? item.label : undefined}
                        >
                            {item.icon === "users" && (
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-2a6 6 0 0112 0v2zm0 0h6v-2a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            )}
                            {item.icon === "briefcase" && (
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                            )}
                            {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
                        </Link>
                    );
                })}
            </nav>

            {/* Create New Job Button (Company Only) */}
            {role === "COMPANY" && (
                <div className="px-3 py-4 border-t border-gray-200">
                    <button
                        type="button"
                        className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-sfinx-purple text-white hover:bg-purple-700 transition-colors font-medium ${
                            isCollapsed ? 'px-2' : ''
                        }`}
                        onClick={() => {
                            router.push('/company-dashboard/jobs/new');
                        }}
                        title={isCollapsed ? "Create New Job" : undefined}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        {!isCollapsed && <span className="text-sm">New Job</span>}
                    </button>
                </div>
            )}

            {/* User Profile Section */}
            {session?.user && (
                <div className="px-3 py-4 border-t border-gray-200">
                    <Menu as="div" className="relative">
                        {({ open }) => (
                            <>
                                {/* Backdrop overlay with smooth fade - rendered at document root */}
                                {typeof window !== 'undefined' && createPortal(
                                    <div
                                        className={`fixed inset-0 bg-black/30 backdrop-blur-[2px] transition-all duration-300 ease-in-out ${
                                            open ? 'opacity-100' : 'opacity-0 pointer-events-none'
                                        }`}
                                        style={{ zIndex: 50 }}
                                        aria-hidden="true"
                                    />,
                                    document.body
                                )}

                                <Menu.Button
                                    ref={setMenuButtonRef}
                                    className="w-full flex items-center gap-3 hover:bg-gray-100 rounded-lg p-2 transition-colors cursor-pointer"
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
                            {!isCollapsed && (
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-gray-900 truncate">
                                        {(session.user as any).name || "User"}
                                    </p>
                                    <p className="text-xs text-gray-500 truncate">
                                        {(session.user as any).email}
                                    </p>
                                </div>
                            )}
                        </Menu.Button>

                        {/* Portal the menu items to document.body for proper z-index stacking */}
                        {typeof window !== 'undefined' && menuButtonRef && createPortal(
                            <div style={{
                                position: 'fixed',
                                bottom: window.innerHeight - menuButtonRef.getBoundingClientRect().top + 8,
                                left: menuButtonRef.getBoundingClientRect().left,
                                zIndex: 100
                            }}>
                                <Menu.Items className="rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 focus:outline-none w-72 overflow-hidden backdrop-blur-xl">
                            {/* User Info Section */}
                            <div className="px-4 py-4 border-b border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center overflow-hidden relative flex-shrink-0">
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
                                                active ? "bg-gray-50" : ""
                                            } group flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 transition-all duration-150 ease-out`}
                                        >
                                            <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                                active ? "bg-gray-50" : ""
                                            } group flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 transition-all duration-150 ease-out w-full cursor-pointer`}
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
        </aside>
    );
}
