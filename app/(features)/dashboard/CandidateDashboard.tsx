"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { DashboardPageLayout, SfinxSpinner } from "app/shared/components";

type StatusTone = "violet" | "blue" | "green" | "red" | "amber" | "slate";

interface DashboardSummary {
    totalApplications: number;
    completedInterviews: number;
    activeItems: number;
    finalDecisions: number;
}

interface DashboardStatus {
    label: string;
    tone: StatusTone;
    isFinal: boolean;
}

interface DashboardInterview {
    id: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    duration: number | null;
    createdAt: string;
    updatedAt: string;
}

interface DashboardApplication {
    id: string;
    rawStatus: string;
    displayStatus: DashboardStatus;
    appliedAt: string;
    updatedAt: string;
    latestActivityAt: string;
    job: {
        id: string;
        title: string;
        location: string;
        type: string;
    } | null;
    company: {
        id: string;
        name: string;
        logo: string | null;
    } | null;
    latestInterview: DashboardInterview | null;
    interviews: DashboardInterview[];
}

interface DashboardResponse {
    summary: DashboardSummary;
    applications: DashboardApplication[];
}

const springCard = { type: "spring", stiffness: 320, damping: 28 } as const;
const springButton = { type: "spring", stiffness: 400, damping: 25 } as const;

const toneClasses: Record<StatusTone, string> = {
    violet: "bg-violet-50 text-violet-700 border border-violet-200",
    blue: "bg-blue-50 text-blue-700 border border-blue-200",
    green: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    red: "bg-red-50 text-red-700 border border-red-200",
    amber: "bg-amber-50 text-amber-700 border border-amber-200",
    slate: "bg-slate-100 text-slate-700 border border-slate-200",
};

function formatDate(date: string | null) {
    if (!date) {
        return "Not available";
    }

    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(new Date(date));
}

function formatDateTime(date: string | null) {
    if (!date) {
        return "Not available";
    }

    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(new Date(date));
}

function formatDuration(duration: number | null) {
    if (!duration || duration <= 0) {
        return "Not recorded";
    }

    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;

    if (minutes === 0) {
        return `${seconds}s`;
    }

    if (seconds === 0) {
        return `${minutes}m`;
    }

    return `${minutes}m ${seconds}s`;
}

function StatusBadge({ status }: { status: DashboardStatus }) {
    return (
        <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${toneClasses[status.tone]}`}
        >
            {status.label}
        </span>
    );
}

function SummaryCard({
    label,
    value,
    caption,
    delay,
}: {
    label: string;
    value: number;
    caption: string;
    delay: number;
}) {
    return (
        <motion.div
            className="glass-card rounded-squircle p-5"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springCard, delay }}
        >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                {label}
            </p>
            <p className="mt-3 text-4xl font-bold tracking-tight text-gray-900">
                {value}
            </p>
            <p className="mt-2 text-sm text-gray-500">{caption}</p>
        </motion.div>
    );
}

function InterviewHistory({
    interviews,
}: {
    interviews: DashboardInterview[];
}) {
    const [isOpen, setIsOpen] = useState(false);
    const previousInterviews = interviews.slice(1);

    if (previousInterviews.length === 0) {
        return null;
    }

    return (
        <div className="mt-5 border-t border-white/60 pt-4">
            <motion.button
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                className="flex w-full items-center justify-between rounded-squircle-sm border border-white/50 bg-white/40 px-4 py-3 text-left"
                whileHover={{ y: -1, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                transition={springButton}
            >
                <div>
                    <p className="text-sm font-semibold text-gray-900">
                        Interview history
                    </p>
                    <p className="text-xs text-gray-500">
                        {previousInterviews.length} prior attempt
                        {previousInterviews.length === 1 ? "" : "s"}
                    </p>
                </div>
                <motion.svg
                    className="h-5 w-5 text-gray-400"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={springButton}
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 7.5 10 12.5l5-5"
                    />
                </motion.svg>
            </motion.button>

            <AnimatePresence initial={false}>
                {isOpen ? (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="mt-3 space-y-3">
                            {previousInterviews.map((interview, index) => (
                                <motion.div
                                    key={interview.id}
                                    className="rounded-squircle-sm border border-white/50 bg-white/45 p-4"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    transition={{ delay: index * 0.04 }}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900">
                                                Attempt {index + 2}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                Started {formatDateTime(interview.startedAt)}
                                            </p>
                                        </div>
                                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                                            {interview.status}
                                        </span>
                                    </div>

                                    <div className="mt-3 grid gap-3 text-sm text-gray-600 md:grid-cols-3">
                                        <div>
                                            <p className="text-xs uppercase tracking-[0.16em] text-gray-400">
                                                Completed
                                            </p>
                                            <p className="mt-1">{formatDateTime(interview.completedAt)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase tracking-[0.16em] text-gray-400">
                                                Duration
                                            </p>
                                            <p className="mt-1">{formatDuration(interview.duration)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase tracking-[0.16em] text-gray-400">
                                                Last updated
                                            </p>
                                            <p className="mt-1">{formatDateTime(interview.updatedAt)}</p>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </div>
    );
}

function ApplicationCard({
    application,
    index,
}: {
    application: DashboardApplication;
    index: number;
}) {
    const latestInterview = application.latestInterview;

    return (
        <motion.article
            className="glass-card rounded-squircle p-6"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springCard, delay: index * 0.06 }}
            whileHover={{ y: -2, scale: 1.01 }}
        >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4">
                    <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-white/60 bg-white/70">
                        {application.company?.logo ? (
                            <Image
                                src={application.company.logo}
                                alt={`${application.company.name} logo`}
                                fill
                                className="object-contain p-2"
                            />
                        ) : (
                            <span className="text-lg font-semibold text-sfinx-purple">
                                {application.company?.name?.charAt(0).toUpperCase() ?? "S"}
                            </span>
                        )}
                    </div>

                    <div>
                        <div className="flex flex-wrap items-center gap-3">
                            <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
                                {application.job?.title ?? "Application"}
                            </h2>
                            <StatusBadge status={application.displayStatus} />
                        </div>
                        <p className="mt-1 text-sm text-gray-500">
                            {application.company?.name ?? "Company pending"}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                            {application.job?.location ? (
                                <span className="rounded-full border border-white/50 bg-white/40 px-3 py-1">
                                    {application.job.location}
                                </span>
                            ) : null}
                            {application.job?.type ? (
                                <span className="rounded-full border border-white/50 bg-white/40 px-3 py-1">
                                    {application.job.type}
                                </span>
                            ) : null}
                            <span className="rounded-full border border-white/50 bg-white/40 px-3 py-1">
                                Applied {formatDate(application.appliedAt)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="rounded-squircle-sm border border-white/50 bg-white/45 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
                        Latest activity
                    </p>
                    <p className="mt-2 text-sm font-medium text-gray-900">
                        {formatDateTime(application.latestActivityAt)}
                    </p>
                </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-squircle-sm border border-white/50 bg-white/45 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-gray-400">
                        Current status
                    </p>
                    <p className="mt-2 text-lg font-semibold text-gray-900">
                        {application.displayStatus.label}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                        Raw application state: {application.rawStatus}
                    </p>
                </div>

                <div className="rounded-squircle-sm border border-white/50 bg-white/45 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-gray-400">
                        Latest interview
                    </p>
                    {latestInterview ? (
                        <>
                            <p className="mt-2 text-lg font-semibold text-gray-900">
                                {latestInterview.status}
                            </p>
                            <p className="mt-1 text-sm text-gray-500">
                                Started {formatDateTime(latestInterview.startedAt)}
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="mt-2 text-lg font-semibold text-gray-900">
                                No interview yet
                            </p>
                            <p className="mt-1 text-sm text-gray-500">
                                This application has not started an interview.
                            </p>
                        </>
                    )}
                </div>

                <div className="rounded-squircle-sm border border-white/50 bg-white/45 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-gray-400">
                        Timeline
                    </p>
                    <p className="mt-2 text-sm text-gray-700">
                        Completed: {formatDateTime(latestInterview?.completedAt ?? null)}
                    </p>
                    <p className="mt-2 text-sm text-gray-700">
                        Duration: {formatDuration(latestInterview?.duration ?? null)}
                    </p>
                </div>
            </div>

            <InterviewHistory interviews={application.interviews} />
        </motion.article>
    );
}

export default function CandidateDashboard() {
    const [data, setData] = useState<DashboardResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const loadDashboard = async () => {
            try {
                setLoading(true);
                const response = await fetch("/api/candidate/dashboard");

                if (!response.ok) {
                    const detail = await response.text();
                    throw new Error(detail || "Failed to load candidate dashboard");
                }

                const payload = (await response.json()) as DashboardResponse;

                if (isMounted) {
                    setData(payload);
                    setError(null);
                }
            } catch (loadError) {
                if (isMounted) {
                    setError(
                        loadError instanceof Error
                            ? loadError.message
                            : "Failed to load candidate dashboard"
                    );
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        loadDashboard();

        return () => {
            isMounted = false;
        };
    }, []);

    const action = (
        <motion.div whileHover={{ y: -1, scale: 1.01 }} whileTap={{ scale: 0.99 }}>
            <Link
                href="/job-search"
                className="inline-flex items-center rounded-squircle-sm bg-sfinx-purple px-4 py-2.5 text-sm font-semibold text-white"
            >
                Browse jobs
            </Link>
        </motion.div>
    );

    return (
        <DashboardPageLayout
            title="Dashboard"
            subtitle="Track every application, interview, and decision from one place."
            action={action}
        >
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <SfinxSpinner
                        size="lg"
                        title="Loading dashboard"
                        messages="Gathering your latest application activity..."
                    />
                </div>
            ) : error ? (
                <div className="glass-card rounded-squircle border border-red-200 bg-red-50/80 p-8 text-center">
                    <h2 className="text-xl font-semibold text-red-700">
                        Dashboard unavailable
                    </h2>
                    <p className="mt-2 text-sm text-red-600">{error}</p>
                    <div className="mt-5">
                        <Link
                            href="/job-search"
                            className="inline-flex items-center rounded-squircle-sm bg-sfinx-purple px-4 py-2.5 text-sm font-semibold text-white"
                        >
                            Browse jobs
                        </Link>
                    </div>
                </div>
            ) : data ? (
                <div className="space-y-8">
                    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <SummaryCard
                            label="Applications"
                            value={data.summary.totalApplications}
                            caption="Roles currently tracked on your dashboard"
                            delay={0}
                        />
                        <SummaryCard
                            label="Active items"
                            value={data.summary.activeItems}
                            caption="Applications still moving through the process"
                            delay={0.05}
                        />
                        <SummaryCard
                            label="Completed interviews"
                            value={data.summary.completedInterviews}
                            caption="Finished interviews waiting on next steps or archived"
                            delay={0.1}
                        />
                        <SummaryCard
                            label="Final decisions"
                            value={data.summary.finalDecisions}
                            caption="Applications with a final yes or no outcome"
                            delay={0.15}
                        />
                    </section>

                    {data.applications.length === 0 ? (
                        <motion.section
                            className="glass-card rounded-squircle px-8 py-12 text-center"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={springCard}
                        >
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 text-sfinx-purple">
                                <svg
                                    className="h-7 w-7"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 12h6m-3-3v6m8 4H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2-2h4l2 2h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2Z"
                                    />
                                </svg>
                            </div>
                            <h2 className="mt-5 text-2xl font-semibold tracking-tight text-gray-900">
                                No tracked applications yet
                            </h2>
                            <p className="mt-2 text-sm text-gray-500">
                                Start an interview from the jobs page and your status history will appear here.
                            </p>
                            <div className="mt-6">
                                <Link
                                    href="/job-search"
                                    className="inline-flex items-center rounded-squircle-sm bg-sfinx-purple px-4 py-2.5 text-sm font-semibold text-white"
                                >
                                    Browse jobs
                                </Link>
                            </div>
                        </motion.section>
                    ) : (
                        <section className="space-y-5">
                            {data.applications.map((application, index) => (
                                <ApplicationCard
                                    key={application.id}
                                    application={application}
                                    index={index}
                                />
                            ))}
                        </section>
                    )}
                </div>
            ) : null}
        </DashboardPageLayout>
    );
}
