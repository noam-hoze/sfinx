"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useDispatch } from "react-redux";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { setNavigationSource } from "@/shared/state/slices/navigationSlice";
import SfinxSpinner from "app/shared/components/SfinxSpinner";
import { DashboardPageLayout } from "app/shared/components";

const springHover  = { type: "spring", stiffness: 400, damping: 25 } as const;
const springEnter  = { type: "spring", stiffness: 260, damping: 28 } as const;
const springCounter = { duration: 1.2, ease: [0.16, 1, 0.3, 1] } as const;

interface JobWithApplicants {
    id: string;
    title: string;
    isActive: boolean;
    applicantCount: number;
    highestScore: number | null;
    averageScore: number | null;
    interviewedCount: number;
}

/** Animated number that counts up with spring physics on mount */
function AnimatedStat({ value, suffix = "" }: { value: number; suffix?: string }) {
    const count = useMotionValue(0);
    const rounded = useTransform(count, (v) => Math.round(v).toString() + suffix);

    useEffect(() => {
        const controls = animate(count, value, springCounter);
        return controls.stop;
    }, [value]);

    return <motion.span>{rounded}</motion.span>;
}

/** Mini score distribution sparkline */
function ScoreDistribution({ scores }: { scores: number[] }) {
    const buckets = [0, 0, 0, 0];
    scores.forEach((s) => {
        if (s < 25) buckets[0]++;
        else if (s < 50) buckets[1]++;
        else if (s < 75) buckets[2]++;
        else buckets[3]++;
    });
    const max = Math.max(...buckets, 1);
    return (
        <div className="flex items-end gap-0.5 h-8">
            {buckets.map((count, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end">
                    <div
                        className={`w-full rounded-t transition-all ${
                            i === 0 ? "bg-red-400" :
                            i === 1 ? "bg-amber-400" :
                            i === 2 ? "bg-blue-400" :
                            "bg-emerald-400"
                        }`}
                        style={{ height: `${(count / max) * 100}%` }}
                    />
                </div>
            ))}
        </div>
    );
}

/** Job card with spring hover and squircle styling */
function JobCard({ job, onClick, index }: { job: JobWithApplicants; onClick: () => void; index: number }) {
    const hasData = job.applicantCount > 0;
    const interviewRate = job.applicantCount > 0 ? (job.interviewedCount / job.applicantCount) * 100 : 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springEnter, delay: index * 0.06 }}
        >
            <motion.button
                onClick={onClick}
                className="group glass-card rounded-squircle p-6 text-left w-full"
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={springHover}
            >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-sfinx-purple transition-colors mb-1">
                            {job.title}
                        </h3>
                        <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                job.isActive
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-gray-100 text-gray-600 border border-gray-200"
                            }`}>
                                {job.isActive ? "● Active" : "Closed"}
                            </span>
                            {hasData && (
                                <span className="text-xs text-gray-500">
                                    {job.interviewedCount}/{job.applicantCount} interviewed
                                </span>
                            )}
                        </div>
                    </div>
                    <svg
                        className="w-5 h-5 text-gray-400 group-hover:text-sfinx-purple group-hover:translate-x-1 transition-all flex-shrink-0 ml-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </div>

                {/* Main Metrics Grid */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center">
                        <div className="text-3xl font-bold text-gray-900">{job.applicantCount}</div>
                        <div className="text-xs text-gray-500 mt-0.5">Applicants</div>
                    </div>
                    <div className="text-center">
                        <div className={`text-3xl font-bold ${
                            !hasData ? "text-gray-300" :
                            (job.highestScore ?? 0) >= 75 ? "text-emerald-600" :
                            (job.highestScore ?? 0) >= 50 ? "text-amber-600" :
                            "text-red-600"
                        }`}>
                            {hasData ? (job.highestScore ?? "—") : "—"}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">Best</div>
                    </div>
                    <div className="text-center">
                        <div className={`text-3xl font-bold ${
                            !hasData ? "text-gray-300" :
                            (job.averageScore ?? 0) >= 75 ? "text-emerald-600" :
                            (job.averageScore ?? 0) >= 50 ? "text-amber-600" :
                            "text-red-600"
                        }`}>
                            {hasData ? (job.averageScore ?? "—") : "—"}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">Average</div>
                    </div>
                </div>

                {/* Quality Indicators */}
                {hasData && (
                    <div className="space-y-2 pt-3 border-t border-white/60">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-600">Interview Rate</span>
                            <span className="font-medium text-gray-900">{interviewRate.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div
                                className={`h-1.5 rounded-full transition-all ${
                                    interviewRate >= 75 ? "bg-emerald-500" :
                                    interviewRate >= 50 ? "bg-amber-500" :
                                    "bg-red-500"
                                }`}
                                style={{ width: `${Math.min(interviewRate, 100)}%` }}
                            />
                        </div>
                    </div>
                )}
            </motion.button>
        </motion.div>
    );
}

/** Asymmetric bento grid for overview stats */
function BentoStats({
    activeJobsCount,
    totalApplicants,
    totalInterviewed,
    conversionPct,
}: {
    activeJobsCount: number;
    totalApplicants: number;
    totalInterviewed: number;
    conversionPct: number;
}) {
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

            {/* Conversion % — col 3-4, rows 1-2 (featured) */}
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

            {/* Interviewed — col 1-2, row 2 */}
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

export default function ApplicantsByJob() {
    const { data: session } = useSession();
    const router = useRouter();
    const pathname = usePathname();
    const dispatch = useDispatch();
    const [jobs, setJobs] = useState<JobWithApplicants[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchJobsWithApplicants();
    }, []);

    async function fetchJobsWithApplicants() {
        try {
            const res = await fetch("/api/company/jobs/with-applicants");
            if (res.ok) {
                const data = await res.json();
                setJobs(data.jobs);
            }
        } catch (error) {
            console.error("Failed to fetch jobs:", error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--page-bg)" }}>
                <SfinxSpinner
                    size="lg"
                    title="Loading Applicants"
                    messages="Fetching job openings and candidates..."
                />
            </main>
        );
    }

    const activeJobs = jobs.filter((j) => j.isActive);
    const closedJobs = jobs.filter((j) => !j.isActive);
    const totalApplicants = jobs.reduce((sum, j) => sum + j.applicantCount, 0);
    const totalInterviewed = jobs.reduce((sum, j) => sum + j.interviewedCount, 0);
    const conversionPct = totalApplicants > 0
        ? Math.round((totalInterviewed / totalApplicants) * 100)
        : 0;

    return (
        <DashboardPageLayout
            title="Applicants by Job"
            subtitle="Select a job opening to view and manage its applicants"
        >
            {jobs.length === 0 ? (
                <motion.div
                    className="glass-card rounded-squircle p-16 text-center"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={springEnter}
                >
                    <div className="w-16 h-16 mx-auto mb-4 bg-violet-50 rounded-squircle flex items-center justify-center">
                        <svg className="w-8 h-8 text-sfinx-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs with applicants yet</h3>
                    <p className="text-gray-500 mb-4">Create a job posting and wait for candidates to apply</p>
                </motion.div>
            ) : (
                <div className="space-y-8">
                    {/* Bento Stats Grid */}
                    <BentoStats
                        activeJobsCount={activeJobs.length}
                        totalApplicants={totalApplicants}
                        totalInterviewed={totalInterviewed}
                        conversionPct={conversionPct}
                    />

                    {/* Active Jobs */}
                    {activeJobs.length > 0 && (
                        <div>
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
                                Active Positions
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {activeJobs.map((job, index) => (
                                    <JobCard
                                        key={job.id}
                                        job={job}
                                        index={index}
                                        onClick={() => {
                                            dispatch(setNavigationSource(pathname));
                                            router.push(`/company-dashboard/applicants/${job.id}`);
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Closed Jobs */}
                    {closedJobs.length > 0 && (
                        <div>
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
                                Closed Positions
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {closedJobs.map((job, index) => (
                                    <JobCard
                                        key={job.id}
                                        job={job}
                                        index={activeJobs.length + index}
                                        onClick={() => {
                                            dispatch(setNavigationSource(pathname));
                                            router.push(`/company-dashboard/applicants/${job.id}`);
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </DashboardPageLayout>
    );
}
