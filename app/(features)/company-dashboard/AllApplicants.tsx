"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useDispatch } from "react-redux";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import Image from "next/image";
import { setNavigationSource } from "@/shared/state/slices/navigationSlice";
import SfinxSpinner from "app/shared/components/SfinxSpinner";
import { DashboardPageLayout } from "app/shared/components";

// ---------------------------------------------------------------------------
// Animation constants
// ---------------------------------------------------------------------------

const springHover   = { type: "spring", stiffness: 400, damping: 25 } as const;
const springEnter   = { type: "spring", stiffness: 260, damping: 28 } as const;
const springCounter = { duration: 1.2, ease: [0.16, 1, 0.3, 1] } as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Applicant {
    id: string;
    name: string;
    email: string;
    image: string | null;
    matchScore: number | null;
    sessionStatus: string | null;
    highlights: string[];
    interviewCompleted: boolean;
    applicationId: string;
    jobId: string;
    jobTitle: string;
    appliedAt: string;
}

interface Job {
    id: string;
    title: string;
    isActive: boolean;
}

interface ApiStats {
    totalApplicants: number;
    totalInterviewed: number;
    activeJobsCount: number;
    conversionPct: number;
}

interface ApiResponse {
    applicants: Applicant[];
    jobs: Job[];
    stats: ApiStats;
}

// ---------------------------------------------------------------------------
// AnimatedStat — counts up with spring physics on mount
// ---------------------------------------------------------------------------

function AnimatedStat({ value, suffix = "" }: { value: number; suffix?: string }) {
    const count = useMotionValue(0);
    const rounded = useTransform(count, (v) => Math.round(v).toString() + suffix);

    useEffect(() => {
        const controls = animate(count, value, springCounter);
        return controls.stop;
    }, [value, count]);

    return <motion.span>{rounded}</motion.span>;
}

// ---------------------------------------------------------------------------
// BentoStats — asymmetric 4-column bento grid (always shows global stats)
// ---------------------------------------------------------------------------

function BentoStats({
    activeJobsCount,
    totalApplicants,
    totalInterviewed,
    conversionPct,
}: ApiStats) {
    const iconBase = "w-10 h-10 rounded-squircle-sm flex items-center justify-center mb-3";

    return (
        <div
            className="grid gap-4"
            style={{
                gridTemplateColumns: "1fr 1fr 1fr 1fr",
                gridTemplateRows: "auto auto",
            }}
        >
            {/* Active Jobs — col 1, row 1 */}
            <motion.div
                className="glass-card rounded-squircle p-5 flex flex-col"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springEnter, delay: 0 }}
            >
                <div className={`${iconBase} bg-violet-50`}>
                    <svg className="w-5 h-5 text-sfinx-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                </div>
                <div className="text-3xl font-bold text-gray-900 tabular-nums">
                    <AnimatedStat value={activeJobsCount} />
                </div>
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mt-1">Active Jobs</div>
            </motion.div>

            {/* Total Applicants — col 2, row 1 */}
            <motion.div
                className="glass-card rounded-squircle p-5 flex flex-col"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springEnter, delay: 0.06 }}
            >
                <div className={`${iconBase} bg-violet-50`}>
                    <svg className="w-5 h-5 text-sfinx-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                </div>
                <div className="text-3xl font-bold text-gray-900 tabular-nums">
                    <AnimatedStat value={totalApplicants} />
                </div>
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mt-1">Total Applicants</div>
            </motion.div>

            {/* Conversion % — col 3–4, rows 1–2 (featured purple tile) */}
            <motion.div
                className="rounded-squircle p-6 flex flex-col justify-between relative overflow-hidden"
                style={{
                    gridColumn: "3 / 5",
                    gridRow: "1 / 3",
                    background: "linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)",
                    boxShadow: "0 12px 40px rgba(139,92,246,0.35), 0 4px 12px rgba(109,40,217,0.2)",
                }}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ ...springEnter, delay: 0.1 }}
            >
                {/* Background glow orb */}
                <div
                    className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-20"
                    style={{ background: "radial-gradient(circle, #fff 0%, transparent 70%)" }}
                />
                <div>
                    <div className="w-10 h-10 rounded-squircle-sm bg-white/20 flex items-center justify-center mb-4">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                    </div>
                    <div className="text-5xl font-bold text-white tabular-nums leading-none">
                        <AnimatedStat value={conversionPct} suffix="%" />
                    </div>
                    <div className="text-xs text-white/70 font-medium uppercase tracking-wider mt-2">Conversion Rate</div>
                </div>
                <p className="text-sm text-white/60 mt-4">
                    {totalInterviewed} of {totalApplicants} candidates interviewed
                </p>
            </motion.div>

            {/* Interviewed — col 1–2, row 2 */}
            <motion.div
                className="glass-card rounded-squircle p-5 flex flex-col"
                style={{ gridColumn: "1 / 3" }}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springEnter, delay: 0.12 }}
            >
                <div className={`${iconBase} bg-violet-50`}>
                    <svg className="w-5 h-5 text-sfinx-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                </div>
                <div className="text-3xl font-bold text-gray-900 tabular-nums">
                    <AnimatedStat value={totalInterviewed} />
                </div>
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mt-1">Interviewed</div>
            </motion.div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// JobFilter — pill-shaped toggle strip
// ---------------------------------------------------------------------------

interface JobFilterProps {
    jobs: Job[];
    selectedJobId: string | null;
    onSelect: (jobId: string | null) => void;
    applicants: Applicant[];
}

function JobFilter({ jobs, selectedJobId, onSelect, applicants }: JobFilterProps) {
    // Compute per-job applicant counts
    const countByJobId = useMemo(() => {
        const map: Record<string, number> = {};
        for (const a of applicants) {
            map[a.jobId] = (map[a.jobId] ?? 0) + 1;
        }
        return map;
    }, [applicants]);

    const allCount = applicants.length;

    return (
        <motion.div
            className="flex items-center gap-4 px-1"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25, delay: 0.18 }}
        >
            {/* Contextual label */}
            <span className="text-xs text-gray-400 uppercase tracking-wider shrink-0 select-none">
                Filter by job:
            </span>

            {/* Pill cluster */}
            <div className="flex flex-wrap gap-2">
                {/* All Jobs pill */}
                <motion.button
                    onClick={() => onSelect(null)}
                    className="relative rounded-full px-4 py-1.5 text-sm font-medium overflow-hidden"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    style={{ isolation: "isolate" }}
                >
                    {/* Sliding purple background — only rendered on the active pill */}
                    {selectedJobId === null && (
                        <motion.span
                            layoutId="job-filter-pill"
                            className="absolute inset-0 rounded-full bg-sfinx-purple"
                            style={{ zIndex: 0 }}
                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        />
                    )}
                    {/* Inactive background — only when not active */}
                    {selectedJobId !== null && (
                        <span
                            className="absolute inset-0 rounded-full bg-white/40 backdrop-blur-sm border border-white/30"
                            style={{ zIndex: 0 }}
                        />
                    )}
                    <span
                        className={`relative flex items-center gap-1.5 ${
                            selectedJobId === null ? "text-white" : "text-gray-600 hover:text-gray-800"
                        }`}
                        style={{ zIndex: 1 }}
                    >
                        All Jobs
                        <span
                            className={`text-xs tabular-nums ${
                                selectedJobId === null ? "text-white/70" : "text-gray-400"
                            }`}
                        >
                            ({allCount})
                        </span>
                    </span>
                </motion.button>

                {/* Per-job pills */}
                {jobs.map((job) => {
                    const isActive = selectedJobId === job.id;
                    const count = countByJobId[job.id] ?? 0;

                    return (
                        <motion.button
                            key={job.id}
                            onClick={() => onSelect(isActive ? null : job.id)}
                            className="relative rounded-full px-4 py-1.5 text-sm font-medium overflow-hidden"
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.97 }}
                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                            style={{ isolation: "isolate" }}
                        >
                            {/* Sliding purple background */}
                            {isActive && (
                                <motion.span
                                    layoutId="job-filter-pill"
                                    className="absolute inset-0 rounded-full bg-sfinx-purple"
                                    style={{ zIndex: 0 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                />
                            )}
                            {/* Inactive glass background */}
                            {!isActive && (
                                <span
                                    className="absolute inset-0 rounded-full bg-white/40 backdrop-blur-sm border border-white/30"
                                    style={{ zIndex: 0 }}
                                />
                            )}
                            <span
                                className={`relative flex items-center gap-1.5 ${
                                    isActive ? "text-white" : "text-gray-600 hover:text-gray-800"
                                }`}
                                style={{ zIndex: 1 }}
                            >
                                {job.title}
                                <span
                                    className={`text-xs tabular-nums ${
                                        isActive ? "text-white/70" : "text-gray-400"
                                    }`}
                                >
                                    ({count})
                                </span>
                            </span>
                        </motion.button>
                    );
                })}
            </div>
        </motion.div>
    );
}

// ---------------------------------------------------------------------------
// CompletedTable — ranked flat table with Job column
// ---------------------------------------------------------------------------

interface CompletedTableProps {
    applicants: Applicant[];
    onRowClick: (applicant: Applicant) => void;
}

function CompletedTable({ applicants, onRowClick }: CompletedTableProps) {
    // Top 5 is computed on the already-filtered set passed in
    return (
        <motion.div
            className="glass-card rounded-squircle overflow-hidden"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springEnter, delay: 0.22 }}
        >
            <div className="overflow-x-auto">
                <table className="w-full table-fixed">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="w-1/4 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Candidate
                            </th>
                            <th className="w-1/6 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Job
                            </th>
                            <th className="w-24 px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Score
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Highlights
                            </th>
                            <th className="w-24 px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        <AnimatePresence initial={false}>
                            {applicants.map((applicant, index) => {
                                const isTopPerformer = index < 5;

                                return (
                                    <motion.tr
                                        key={applicant.applicationId}
                                        onClick={() => onRowClick(applicant)}
                                        className={`relative cursor-pointer ${
                                            applicant.sessionStatus === "PROCESSING"
                                                ? "border-l-4 border-violet-400/70"
                                                : isTopPerformer
                                                ? "bg-gradient-to-r from-purple-50/40 to-blue-50/40 border-l-4 border-purple-500/40 animate-subtle-pulse"
                                                : ""
                                        }`}
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 8 }}
                                        transition={{ ...springEnter, delay: index * 0.03 }}
                                        whileHover={{
                                            backgroundColor:
                                                applicant.sessionStatus === "PROCESSING"
                                                    ? "rgba(139,92,246,0.04)"
                                                    : isTopPerformer
                                                    ? "rgba(139,92,246,0.06)"
                                                    : "rgba(139,92,246,0.03)",
                                        }}
                                    >
                                        {/* Candidate */}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                    {applicant.image ? (
                                                        <Image
                                                            src={applicant.image}
                                                            alt={applicant.name}
                                                            width={40}
                                                            height={40}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <span className="text-sm font-semibold text-gray-600">
                                                            {applicant.name.charAt(0).toUpperCase()}
                                                        </span>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-gray-900">{applicant.name}</div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Job */}
                                        <td className="px-6 py-4">
                                            <span className="bg-violet-50 text-violet-700 text-xs rounded-full px-2 py-0.5 font-medium">
                                                {applicant.jobTitle}
                                            </span>
                                        </td>

                                        {/* Score */}
                                        <td className="px-6 py-4 text-center" data-testid="applicant-score">
                                            {applicant.sessionStatus === "PROCESSING" ? (
                                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-50 border border-violet-200/60">
                                                    <motion.svg
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        className="w-3 h-3 text-violet-500 shrink-0"
                                                        animate={{ rotate: 360 }}
                                                        transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                                                    >
                                                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                                                    </motion.svg>
                                                    <span className="text-xs font-medium text-violet-600 whitespace-nowrap">Analyzing…</span>
                                                </div>
                                            ) : applicant.matchScore !== null ? (
                                                <div className={`text-xl font-bold tabular-nums ${
                                                    applicant.matchScore >= 75
                                                        ? "text-emerald-600"
                                                        : applicant.matchScore >= 50
                                                        ? "text-amber-600"
                                                        : "text-red-600"
                                                }`}>
                                                    {Math.round(applicant.matchScore)}
                                                </div>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>

                                        {/* Highlights */}
                                        <td className="px-6 py-4">
                                            {applicant.sessionStatus === "PROCESSING" ? (
                                                <div className="flex gap-2">
                                                    {([80, 64, 96] as const).map((w, i) => (
                                                        <div key={i} className="h-6 rounded-full overflow-hidden flex-shrink-0" style={{ width: w }}>
                                                            <motion.div
                                                                className="h-full w-full"
                                                                style={{
                                                                    background: "linear-gradient(90deg, #EDE9FE 0%, #DDD6FE 35%, #C4B5FD 50%, #DDD6FE 65%, #EDE9FE 100%)",
                                                                    backgroundSize: "200% 100%",
                                                                }}
                                                                animate={{ backgroundPosition: ["200% 0%", "-200% 0%"] }}
                                                                transition={{ duration: 1.8, repeat: Infinity, ease: "linear", delay: i * 0.3 }}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : applicant.highlights?.length > 0 ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {applicant.highlights.map((highlight, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full"
                                                        >
                                                            {highlight}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 text-sm">-</span>
                                            )}
                                        </td>

                                        {/* Actions */}
                                        <td className="px-6 py-4 text-center">
                                            <svg
                                                className="w-5 h-5 text-gray-400 inline-block"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </AnimatePresence>
                    </tbody>
                </table>
            </div>
        </motion.div>
    );
}

// ---------------------------------------------------------------------------
// PendingTable — dimmed table with Job column and amber status badge
// ---------------------------------------------------------------------------

interface PendingTableProps {
    applicants: Applicant[];
}

function PendingTable({ applicants }: PendingTableProps) {
    return (
        <motion.div
            className="glass-card rounded-squircle overflow-hidden opacity-60"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 0.6, y: 0 }}
            transition={{ ...springEnter, delay: 0.28 }}
        >
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Pending Interviews
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Job
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        <AnimatePresence initial={false}>
                            {applicants.map((applicant) => (
                                <motion.tr
                                    key={applicant.applicationId}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={springEnter}
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                {applicant.image ? (
                                                    <Image
                                                        src={applicant.image}
                                                        alt={applicant.name}
                                                        width={40}
                                                        height={40}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <span className="text-sm font-semibold text-gray-600">
                                                        {applicant.name.charAt(0).toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900">{applicant.name}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="bg-violet-50 text-violet-700 text-xs rounded-full px-2 py-0.5 font-medium">
                                            {applicant.jobTitle}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-full">
                                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                                            Pending
                                        </span>
                                    </td>
                                </motion.tr>
                            ))}
                        </AnimatePresence>
                    </tbody>
                </table>
            </div>
        </motion.div>
    );
}

// ---------------------------------------------------------------------------
// AllApplicants — main export
// ---------------------------------------------------------------------------

export default function AllApplicants() {
    const router = useRouter();
    const pathname = usePathname();
    const dispatch = useDispatch();

    const [data, setData] = useState<ApiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

    useEffect(() => {
        let intervalId: ReturnType<typeof setInterval> | null = null;

        async function fetchApplicants() {
            try {
                const res = await fetch("/api/company/applicants");
                if (res.ok) {
                    const json: ApiResponse = await res.json();
                    setData(json);
                    const hasProcessing = json.applicants.some((a) => a.sessionStatus === "PROCESSING");
                    if (hasProcessing && !intervalId) {
                        intervalId = setInterval(fetchApplicants, 5000);
                    } else if (!hasProcessing && intervalId) {
                        clearInterval(intervalId);
                        intervalId = null;
                    }
                }
            } catch (error) {
                console.error("Failed to fetch applicants:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchApplicants();

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, []);

    // Client-side filtering by selected job
    const filteredApplicants = useMemo(() => {
        if (!data) return [];
        if (selectedJobId === null) return data.applicants;
        return data.applicants.filter((a) => a.jobId === selectedJobId);
    }, [data, selectedJobId]);

    const completedApplicants = useMemo(
        () => filteredApplicants.filter((a) => a.interviewCompleted),
        [filteredApplicants]
    );

    const pendingApplicants = useMemo(
        () => filteredApplicants.filter((a) => !a.interviewCompleted),
        [filteredApplicants]
    );

    function handleRowClick(applicant: Applicant) {
        dispatch(setNavigationSource(pathname));
        router.push(`/cps?candidateId=${applicant.id}&applicationId=${applicant.applicationId}`);
    }

    // Loading state
    if (loading) {
        return (
            <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--page-bg)" }}>
                <SfinxSpinner size="lg" title="Loading Applicants" messages="Fetching candidates..." />
            </main>
        );
    }

    // Global empty state (no applicants at all across all jobs)
    if (!data || data.applicants.length === 0) {
        return (
            <DashboardPageLayout
                title="Applicants"
                subtitle="View and manage all candidates across your job openings"
            >
                <motion.div
                    className="glass-card rounded-squircle p-16 text-center"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={springEnter}
                >
                    <div className="w-16 h-16 mx-auto mb-4 bg-violet-50 rounded-squircle flex items-center justify-center">
                        <svg className="w-8 h-8 text-sfinx-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No applicants yet</h3>
                    <p className="text-gray-500">Candidates who apply to your open positions will appear here</p>
                </motion.div>
            </DashboardPageLayout>
        );
    }

    return (
        <DashboardPageLayout
            title="Applicants"
            subtitle="View and manage all candidates across your job openings"
        >
            <div className="space-y-6">
                {/* Global bento stats — never filtered */}
                <BentoStats
                    activeJobsCount={data.stats.activeJobsCount}
                    totalApplicants={data.stats.totalApplicants}
                    totalInterviewed={data.stats.totalInterviewed}
                    conversionPct={data.stats.conversionPct}
                />

                {/* Job filter strip */}
                {data.jobs.length > 1 && (
                    <JobFilter
                        jobs={data.jobs}
                        selectedJobId={selectedJobId}
                        onSelect={setSelectedJobId}
                        applicants={data.applicants}
                    />
                )}

                {/* Completed applicants table */}
                <AnimatePresence mode="wait">
                    {completedApplicants.length > 0 ? (
                        <CompletedTable
                            key={`completed-${selectedJobId ?? "all"}`}
                            applicants={completedApplicants}
                            onRowClick={handleRowClick}
                        />
                    ) : (
                        <motion.div
                            key="completed-empty"
                            className="glass-card rounded-squircle p-10 text-center"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={springEnter}
                        >
                            <p className="text-gray-400 text-sm">No completed interviews for this selection</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Pending applicants table */}
                <AnimatePresence mode="wait">
                    {pendingApplicants.length > 0 && (
                        <PendingTable
                            key={`pending-${selectedJobId ?? "all"}`}
                            applicants={pendingApplicants}
                        />
                    )}
                </AnimatePresence>
            </div>
        </DashboardPageLayout>
    );
}
