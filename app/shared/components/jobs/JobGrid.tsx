"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

export interface JobGridCompany {
    id: string;
    name: string;
    logo?: string | null;
    industry: string;
    size: string;
}

type LinkHref = Parameters<typeof Link>[0]["href"];

export interface JobGridJob {
    id: string;
    title: string;
    location: string;
    type: string;
    description?: string | null;
    company: JobGridCompany;
}

interface JobGridProps {
    items: JobGridJob[];
    showLogo: boolean;
    showCompanyName?: boolean;
    onCardClick?: (job: JobGridJob) => void;
    getHref?: (job: JobGridJob) => LinkHref | null;
    renderBadge?: (job: JobGridJob) => React.ReactNode;
    renderActions?: (job: JobGridJob) => React.ReactNode;
    emptyLabel?: string;
}

const springHover = { type: "spring", stiffness: 400, damping: 25 } as const;

/**
 * Renders a responsive grid of job cards that can show or hide company logos.
 */
export function JobGrid({
    items,
    showLogo,
    showCompanyName = true,
    onCardClick,
    getHref,
    renderBadge,
    renderActions,
    emptyLabel,
}: JobGridProps) {
    if (items.length === 0) {
        const emptyHeading =
            emptyLabel !== undefined ? emptyLabel : "No jobs found";
        return (
            <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-violet-50 rounded-squircle flex items-center justify-center">
                    <svg
                        className="w-8 h-8 text-sfinx-purple"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                    </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {emptyHeading}
                </h3>
                <p className="text-gray-500">
                    Adjust your filters or create a new job to get started.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {items.map((job, index) => {
                const { company } = job;
                if (!company) {
                    throw new Error("JobGrid requires company data on every job");
                }
                const href = getHref ? getHref(job) : null;

                const card = (
                    <motion.div
                        className="group glass-card rounded-squircle p-6 flex flex-col h-full"
                        onClick={() => {
                            if (onCardClick) onCardClick(job);
                        }}
                        role={onCardClick ? "button" : "presentation"}
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        transition={springHover}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        // stagger cards on load
                        style={{ transitionDelay: `${index * 40}ms` } as React.CSSProperties}
                    >
                        {showLogo && (
                            <div className="relative w-full h-24 mx-auto mb-4 bg-white/80 rounded-squircle-sm flex items-center justify-center p-4">
                                {company.logo ? (
                                    <Image
                                        src={company.logo}
                                        alt={`${company.name} logo`}
                                        fill
                                        className="object-contain p-2"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">
                                        No Logo
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="text-center">
                            <p className="text-sm text-gray-700 font-medium mb-1">{job.title}</p>
                        </div>

                        <div className="mt-auto pt-3 flex flex-col gap-2 items-center">
                            <span className="px-2 py-1 bg-violet-50 text-sfinx-purple text-xs rounded-full font-medium">
                                {company.industry}
                            </span>
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                {company.size}
                            </span>
                            {renderBadge ? renderBadge(job) : null}
                        </div>

                        {renderActions ? (
                            <div className="mt-4 flex items-center justify-center gap-2">
                                {renderActions(job)}
                            </div>
                        ) : null}
                    </motion.div>
                );

                if (href) {
                    return (
                        <Link key={job.id} href={href} className="block">
                            {card}
                        </Link>
                    );
                }

                return (
                    <div key={job.id} className="block">
                        {card}
                    </div>
                );
            })}
        </div>
    );
}
