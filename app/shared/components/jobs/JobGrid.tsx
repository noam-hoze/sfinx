import React from "react";
import Link from "next/link";
import Image from "next/image";

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
    renderFooter?: (job: JobGridJob) => React.ReactNode;
    emptyLabel?: string;
}

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
    renderFooter,
    emptyLabel,
}: JobGridProps) {
    if (items.length === 0) {
        const emptyHeading =
            emptyLabel !== undefined ? emptyLabel : "No jobs found";
        return (
            <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg
                        className="w-8 h-8 text-gray-400"
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
                <p className="text-gray-600">
                    Adjust your filters or create a new job to get started.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {items.map((job) => {
                const { company } = job;
                if (!company) {
                    throw new Error("JobGrid requires company data on every job");
                }
                const href = getHref ? getHref(job) : null;
                const card = (
                    <div
                        className={`group bg-white/60 backdrop-blur-sm rounded-2xl border border-white/20 p-6 hover:bg-white/80 hover:shadow-lg transition-all duration-300 ease-out hover:scale-105 flex flex-col h-full`}
                        onClick={() => {
                            if (onCardClick) {
                                onCardClick(job);
                            }
                        }}
                        role={onCardClick ? "button" : "presentation"}
                    >
                        {showLogo && (
                            <div className="relative w-24 h-24 mx-auto mb-4 bg-white rounded-xl flex items-center justify-center p-3">
                                {company.logo ? (
                                    <Image
                                        src={company.logo}
                                        alt={`${company.name} logo`}
                                        width={72}
                                        height={72}
                                        className="object-contain"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">
                                        No Logo
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="text-center flex-1">
                            {showCompanyName && (
                                <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                                    {company.name}
                                </h3>
                            )}
                            <p className="text-sm text-gray-600 mb-1">{job.title}</p>
                            <p className="text-xs text-gray-500 mb-1">
                                {job.location} • {job.type}
                            </p>
                            {job.description ? (
                                <p className="text-xs text-gray-500 line-clamp-2">
                                    {job.description}
                                </p>
                            ) : null}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1 justify-center">
                            <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded-full">
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

                        {renderFooter ? (
                            <div className="mt-4 w-full">{renderFooter(job)}</div>
                        ) : null}
                    </div>
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

