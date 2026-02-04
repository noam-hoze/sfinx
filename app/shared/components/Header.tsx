"use client";

import React from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu } from "@headlessui/react";
import { useSelector } from "react-redux";
import type { RootState } from "@/shared/state/store";
import { log } from "../services";
import { useMute, useDebug } from "../contexts";

const logger = log;

export default function Header() {
    const { data: session } = useSession();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { isMuted, toggleMute } = useMute();
    const { isDebugVisible, showDebugButton } = useDebug();
    const role = (session?.user as any)?.role;

    const noHeaderPaths = ["/", "/login", "/signup"];

    if (noHeaderPaths.includes(pathname)) {
        return null;
    }

    const handleSignOut = async () => {
        await signOut({ callbackUrl: "/login" });
    };

    const settingsPath = role === "COMPANY" ? "/company-dashboard/settings" : "/settings";

    return (
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            {/* Left: Empty for now (could add breadcrumbs here in the future) */}
            <div></div>

            {/* Right: Actions and User Menu */}
            <div className="flex items-center justify-end gap-4">
                {/* Debug Panel Toggle Button */}
                {process.env.NEXT_PUBLIC_DEBUG_MODE === "true" && showDebugButton && (
                    <button
                        onClick={() => {
                            // Toggle debug panel - dispatch custom event
                            window.dispatchEvent(new CustomEvent('toggleDebugPanel'));
                        }}
                        className={`w-10 h-10 rounded-full border-2 border-sfinx-purple transition-all flex items-center justify-center ${
                            isDebugVisible ? 'bg-sfinx-purple text-white' : 'text-sfinx-purple hover:bg-sfinx-purple hover:text-white'
                        }`}
                        title="Toggle Debug Panel"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                        </svg>
                    </button>
                )}

                {pathname === '/interview' && (
                    <button
                        onClick={toggleMute}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                        title={isMuted ? "Unmute" : "Mute"}
                    >
                        {isMuted ? (
                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>
                        )}
                    </button>
                )}

                {session?.user && (
                    <Menu as="div" className="relative">
                        <Menu.Button className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden relative cursor-pointer">
                            {session.user.image ? (
                                <Image
                                    key={session.user.image} // Force re-render when image changes
                                    src={session.user.image}
                                    alt="Profile"
                                    fill
                                    sizes="40px"
                                    className="object-cover rounded-full"
                                />
                            ) : (
                                <span className="text-xs font-medium text-gray-700">
                                    {(session.user as any).name
                                        ?.charAt(0)
                                        ?.toUpperCase() ||
                                        (session.user as any).email
                                            ?.charAt(0)
                                            ?.toUpperCase()}
                                </span>
                            )}
                        </Menu.Button>
                        <Menu.Items className="absolute right-0 mt-3 origin-top-right rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 focus:outline-none w-64 z-50 overflow-hidden backdrop-blur-xl">
                            {/* User Info Section */}
                            <div className="px-4 py-4 border-b border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center overflow-hidden relative">
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
                    </Menu>
                )}
            </div>
        </header>
    );
}
