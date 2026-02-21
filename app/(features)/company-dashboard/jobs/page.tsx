"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { AuthGuard, DashboardPageLayout } from "app/shared/components";
import SfinxSpinner from "app/shared/components/SfinxSpinner";
import { log } from "app/shared/services";
import type { JobGridJob, JobGridCompany } from "app/shared/components/jobs/JobGrid";
import { readResponseError } from "app/shared/utils/http";
import InterviewContentSection, {
    InterviewContentState,
    InterviewDurationState,
    defaultInterviewDurations,
    emptyInterviewContentState,
} from "./components/InterviewContentSection";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.COMPANY_DASHBOARD;

// ── Animation presets ──────────────────────────────────────────────────────
const springHover   = { type: "spring", stiffness: 400, damping: 35 } as const;
const springEnter   = { type: "spring", stiffness: 260, damping: 28 } as const;
const springCounter = { duration: 1.2, ease: [0.16, 1, 0.3, 1] } as const;

// ── Types ──────────────────────────────────────────────────────────────────
interface CompanyJobListItem extends JobGridJob {
    salary: string | null;
    requirements: string | null;
    interviewContent: null | {
        id: string;
        backgroundQuestion: string | null;
        codingPrompt: string;
        codingTemplate: string | null;
        codingAnswer: string | null;
    };
}

interface CompanyJobsResponse {
    company: JobGridCompany;
    jobs: CompanyJobListItem[];
}

interface CreateJobState {
    title: string;
    location: string;
    type: string;
    salary: string;
    description: string;
    requirements: string;
}

const defaultCreateState: CreateJobState = {
    title: "",
    location: "",
    type: "",
    salary: "",
    description: "",
    requirements: "",
};

// Derived stats shape passed to BentoStats
interface JobStats {
    totalJobs: number;
    activeCount: number;
    withInterview: number;
    avgCompletePct: number;
}

// ── Animated counter ───────────────────────────────────────────────────────
function AnimatedStat({ value, suffix = "" }: { value: number; suffix?: string }) {
    const count = useMotionValue(0);
    const rounded = useTransform(count, (v) => Math.round(v).toString() + suffix);

    useEffect(() => {
        const controls = animate(count, value, springCounter);
        return controls.stop;
    }, [value]);

    return <motion.span>{rounded}</motion.span>;
}

// ── Bento stats grid ───────────────────────────────────────────────────────
function BentoStats({ totalJobs, activeCount, withInterview, avgCompletePct }: JobStats) {
    const iconBase = "w-10 h-10 rounded-squircle-sm flex items-center justify-center mb-3";

    return (
        <div
            className="grid gap-4"
            style={{
                gridTemplateColumns: "1fr 1fr 1fr 1fr",
                gridTemplateRows: "auto auto",
            }}
        >
            {/* Total Jobs — col 1, row 1 */}
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
                    <AnimatedStat value={totalJobs} />
                </div>
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mt-1">Total Jobs</div>
            </motion.div>

            {/* Active Jobs — col 2, row 1 */}
            <motion.div
                className="glass-card rounded-squircle p-5 flex flex-col"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springEnter, delay: 0.06 }}
            >
                <div className={`${iconBase} bg-violet-50`}>
                    <svg className="w-5 h-5 text-sfinx-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <div className="text-3xl font-bold text-gray-900 tabular-nums">
                    <AnimatedStat value={activeCount} />
                </div>
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mt-1">Active</div>
            </motion.div>

            {/* Avg Complete — col 3-4, rows 1-2 (featured purple tile) */}
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
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <div className="text-5xl font-bold text-white tabular-nums leading-none">
                        <AnimatedStat value={avgCompletePct} suffix="%" />
                    </div>
                    <div className="text-xs text-white/70 font-medium uppercase tracking-wider mt-2">Avg Complete</div>
                </div>
                <p className="text-sm text-white/60 mt-4">
                    {withInterview} of {totalJobs} positions have interview content
                </p>
            </motion.div>

            {/* With Interview — col 1-2, row 2 */}
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
                    <AnimatedStat value={withInterview} />
                </div>
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mt-1">With Interview</div>
            </motion.div>
        </div>
    );
}

// ── Job card ───────────────────────────────────────────────────────────────
interface JobCardProps {
    job: JobGridJob;
    rawJob: CompanyJobListItem | undefined;
    index: number;
    onEdit: (e: React.MouseEvent) => void;
    onDelete: (e: React.MouseEvent) => void;
    onClick: () => void;
    deleteInFlight: boolean;
}

function JobCard({ job, rawJob, index, onEdit, onDelete, onClick, deleteInFlight }: JobCardProps) {
    const hasInterview = rawJob?.interviewContent !== null && rawJob?.interviewContent !== undefined;
    const hasDescription = Boolean(job.description && job.description.length > 0);
    const hasSalary = Boolean(rawJob?.salary && rawJob.salary.length > 0);
    const hasRequirements = Boolean(rawJob?.requirements && rawJob.requirements.length > 0);
    const completeness = [hasDescription, hasSalary, hasRequirements, hasInterview].filter(Boolean).length;
    const completePct = Math.round((completeness / 4) * 100);

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springEnter, delay: index * 0.06 }}
        >
            <motion.div
                role="button"
                tabIndex={0}
                onClick={onClick}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
                className="group glass-card rounded-squircle p-6 text-left w-full relative cursor-pointer"
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={springHover}
            >
                {/* Action icons — top right */}
                <div className="absolute top-4 right-4 flex items-center gap-1.5 z-10">
                    {/* Delete icon */}
                    <button
                        type="button"
                        onClick={onDelete}
                        disabled={deleteInFlight}
                        className="w-8 h-8 rounded-full bg-gray-100 hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors disabled:opacity-60"
                        title="Delete job"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                    {/* Edit icon */}
                    <button
                        type="button"
                        onClick={onEdit}
                        className="w-8 h-8 rounded-full bg-violet-50 hover:bg-violet-100 flex items-center justify-center text-sfinx-purple transition-colors"
                        title="Edit job"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                </div>

                {/* Header */}
                <div className="flex items-start mb-4 pr-10">
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-sfinx-purple transition-colors mb-1 line-clamp-2">
                            {job.title}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Active badge */}
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                Active
                            </span>
                            {/* Interview badge */}
                            {hasInterview && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-sfinx-purple border border-violet-200">
                                    Interview ready
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Meta row */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-sm text-gray-500">
                    {job.location && (
                        <span className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {job.location}
                        </span>
                    )}
                    {job.type && (
                        <span className="flex items-center gap-1.5 capitalize">
                            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {job.type}
                        </span>
                    )}
                    {hasSalary && (
                        <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {rawJob?.salary}
                        </span>
                    )}
                </div>

                {/* Description snippet */}
                {hasDescription && (
                    <p className="text-xs text-gray-400 line-clamp-2 mb-4">
                        {job.description}
                    </p>
                )}

                {/* Completeness bar */}
                <div className="pt-3 border-t border-white/60 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Profile complete</span>
                        <span className={`font-medium ${
                            completePct === 100 ? "text-emerald-600" :
                            completePct >= 50   ? "text-amber-600"   :
                            "text-gray-400"
                        }`}>{completeness}/4</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                            className={`h-1.5 rounded-full transition-all ${
                                completePct === 100 ? "bg-emerald-500" :
                                completePct >= 50   ? "bg-amber-500"   :
                                "bg-gray-300"
                            }`}
                            style={{ width: `${completePct}%` }}
                        />
                    </div>
                </div>

            </motion.div>
        </motion.div>
    );
}

// ── Create job form ────────────────────────────────────────────────────────
interface CreateJobFormProps {
    createState: CreateJobState;
    setCreateState: React.Dispatch<React.SetStateAction<CreateJobState>>;
    interviewState: InterviewContentState;
    setInterviewState: React.Dispatch<React.SetStateAction<InterviewContentState>>;
    interviewDurations: InterviewDurationState;
    setInterviewDurations: React.Dispatch<React.SetStateAction<InterviewDurationState>>;
    createSubmitting: boolean;
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    onCancel: () => void;
}

function CreateJobForm({
    createState,
    setCreateState,
    interviewState,
    setInterviewState,
    interviewDurations,
    setInterviewDurations,
    createSubmitting,
    onSubmit,
    onCancel,
}: CreateJobFormProps) {
    const inputClass =
        "mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 bg-white/50 backdrop-blur-sm focus:border-sfinx-purple focus:ring-2 focus:ring-sfinx-purple/20 outline-none transition-all";

    return (
        <motion.form
            className="glass-card rounded-squircle p-6 mb-8"
            onSubmit={onSubmit}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={springEnter}
        >
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-semibold text-gray-900 tracking-tight">New Job</h2>
                <button
                    type="button"
                    className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
                    onClick={onCancel}
                >
                    Cancel
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex flex-col text-sm font-medium text-gray-700">
                    Title
                    <input
                        value={createState.title}
                        onChange={(e) => setCreateState((prev) => ({ ...prev, title: e.target.value }))}
                        className={inputClass}
                        required
                    />
                </label>
                <label className="flex flex-col text-sm font-medium text-gray-700">
                    Location
                    <input
                        value={createState.location}
                        onChange={(e) => setCreateState((prev) => ({ ...prev, location: e.target.value }))}
                        className={inputClass}
                        required
                    />
                </label>
                <label className="flex flex-col text-sm font-medium text-gray-700">
                    Type
                    <input
                        value={createState.type}
                        onChange={(e) => setCreateState((prev) => ({ ...prev, type: e.target.value }))}
                        className={inputClass}
                        placeholder="e.g. full-time"
                        required
                    />
                </label>
                <label className="flex flex-col text-sm font-medium text-gray-700">
                    Salary
                    <input
                        value={createState.salary}
                        onChange={(e) => setCreateState((prev) => ({ ...prev, salary: e.target.value }))}
                        className={inputClass}
                        placeholder="$150k – $200k"
                    />
                </label>
                <label className="flex flex-col text-sm font-medium text-gray-700 md:col-span-2">
                    Description
                    <textarea
                        value={createState.description}
                        onChange={(e) => setCreateState((prev) => ({ ...prev, description: e.target.value }))}
                        className={`${inputClass} min-h-[120px]`}
                    />
                </label>
                <label className="flex flex-col text-sm font-medium text-gray-700 md:col-span-2">
                    Requirements
                    <textarea
                        value={createState.requirements}
                        onChange={(e) => setCreateState((prev) => ({ ...prev, requirements: e.target.value }))}
                        className={`${inputClass} min-h-[120px]`}
                    />
                </label>
            </div>

            <div className="mt-6">
                <InterviewContentSection
                    state={interviewState}
                    onChange={setInterviewState}
                    durations={interviewDurations}
                    onDurationChange={setInterviewDurations}
                    disabled={createSubmitting}
                    subtitle="Optional: configure the background conversation, coding prompt, and timers candidates will experience."
                    allowEmptyCodingPrompt={false}
                />
            </div>

            <div className="mt-4 flex justify-end gap-3">
                <button
                    type="button"
                    className="px-4 py-2 rounded-squircle-sm border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    onClick={onCancel}
                    disabled={createSubmitting}
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="px-4 py-2 rounded-squircle-sm bg-sfinx-purple hover:bg-sfinx-purple-dark text-white text-sm font-medium transition-colors disabled:opacity-60"
                    disabled={createSubmitting}
                >
                    {createSubmitting ? "Saving..." : "Save"}
                </button>
            </div>
        </motion.form>
    );
}

// ── Main content ───────────────────────────────────────────────────────────
function CompanyJobsContent() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [jobs, setJobs] = useState<CompanyJobListItem[]>([]);
    const [createMode, setCreateMode] = useState(false);
    const [createState, setCreateState] = useState<CreateJobState>(defaultCreateState);
    const [interviewState, setInterviewState] = useState<InterviewContentState>(emptyInterviewContentState);
    const [interviewDurations, setInterviewDurations] = useState<InterviewDurationState>(defaultInterviewDurations);
    const [createSubmitting, setCreateSubmitting] = useState(false);
    const [deleteInFlight, setDeleteInFlight] = useState<string | null>(null);
    const [editingJobId, setEditingJobId] = useState<string | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("create") === "true") {
            setCreateMode(true);
            params.delete("create");
            const newUrl =
                window.location.pathname +
                (params.toString() ? "?" + params.toString() : "");
            window.history.replaceState({}, "", newUrl);
        }
    }, []);

    useEffect(() => {
        const fetchJobs = async () => {
            log.info(LOG_CATEGORY, "Fetching company jobs...");
            try {
                const resp = await fetch("/api/company/jobs");
                if (!resp.ok) {
                    const detail = await readResponseError(resp);
                    throw new Error(`Failed to load company jobs: ${resp.status} ${detail}`);
                }
                const data = (await resp.json()) as CompanyJobsResponse;
                if (!data.company) throw new Error("Response missing company data");

                setJobs(
                    data.jobs.map((job) => ({
                        ...job,
                        description:
                            typeof job.description === "string" ? job.description : null,
                        company: {
                            id: data.company.id,
                            name: data.company.name,
                            logo: null,
                            industry: data.company.industry,
                            size: data.company.size,
                        },
                    }))
                );
                setError(null);
            } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown error";
                log.error(LOG_CATEGORY, "Failed to fetch company jobs:", err);
                setError(message);
            } finally {
                setLoading(false);
            }
        };
        fetchJobs().catch((err) => {
            log.error(LOG_CATEGORY, "Unexpected fetch error:", err);
        });
    }, []);

    const resetCreateForm = () => {
        setCreateState(defaultCreateState);
        setInterviewState(emptyInterviewContentState);
        setInterviewDurations(defaultInterviewDurations);
    };

    const handleCreateJob = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setCreateSubmitting(true);
        try {
            const hasInterviewContent =
                interviewState.backgroundQuestion.trim().length > 0 ||
                interviewState.codingPrompt.trim().length > 0 ||
                interviewState.codingTemplate.trim().length > 0 ||
                interviewState.codingAnswer.trim().length > 0;

            if (hasInterviewContent && interviewState.codingPrompt.trim().length === 0) {
                setError("Coding prompt is required when adding interview content.");
                setCreateSubmitting(false);
                return;
            }

            const payload: Record<string, unknown> = {
                title: createState.title,
                location: createState.location,
                type: createState.type,
                salary: createState.salary,
                description: createState.description,
                requirements: createState.requirements,
            };

            if (hasInterviewContent) {
                payload.interviewContent = {
                    backgroundQuestion: interviewState.backgroundQuestion,
                    codingPrompt: interviewState.codingPrompt.trim(),
                    codingTemplate:
                        interviewState.codingTemplate.trim().length > 0
                            ? interviewState.codingTemplate
                            : null,
                    codingAnswer:
                        interviewState.codingAnswer.trim().length > 0
                            ? interviewState.codingAnswer
                            : null,
                    backgroundQuestionTimeSeconds: interviewDurations.backgroundSeconds,
                    codingQuestionTimeSeconds: interviewDurations.codingSeconds,
                };
            }

            const resp = await fetch("/api/company/jobs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!resp.ok) {
                const detail = await readResponseError(resp);
                throw new Error(`Failed to create job: ${resp.status} ${detail}`);
            }
            const created = (await resp.json()) as CompanyJobsResponse["jobs"][number];
            setJobs((prev) => [
                {
                    ...created,
                    description:
                        typeof created.description === "string" ? created.description : null,
                    company: {
                        id: created.company.id,
                        name: created.company.name,
                        logo: null,
                        industry: created.company.industry,
                        size: created.company.size,
                    },
                },
                ...prev,
            ]);
            resetCreateForm();
            setCreateMode(false);
            setError(null);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            setError(message);
            log.error(LOG_CATEGORY, "Failed to create job:", err);
        } finally {
            setCreateSubmitting(false);
        }
    };

    const handleDeleteJob = async (jobId: string) => {
        setDeleteInFlight(jobId);
        try {
            const resp = await fetch(`/api/company/jobs/${jobId}`, { method: "DELETE" });
            if (!resp.ok) {
                const detail = await readResponseError(resp);
                throw new Error(`Failed to delete job: ${resp.status} ${detail}`);
            }
            setJobs((prev) => prev.filter((job) => job.id !== jobId));
        } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            setError(message);
            log.error(LOG_CATEGORY, "Failed to delete job:", err);
        } finally {
            setDeleteInFlight(null);
        }
    };

    // Derived stats
    const withInterview = jobs.filter((j) => j.interviewContent !== null).length;
    const avgCompletePct =
        jobs.length > 0
            ? Math.round(
                  jobs.reduce((sum, j) => {
                      const hasDescription = j.description && j.description.length > 0;
                      const hasSalary = j.salary && j.salary.length > 0;
                      const hasRequirements = j.requirements && j.requirements.length > 0;
                      const hasInterview = j.interviewContent !== null;
                      const completeness = [hasDescription, hasSalary, hasRequirements, hasInterview].filter(Boolean).length;
                      return sum + (completeness / 4) * 100;
                  }, 0) / jobs.length
              )
            : 0;

    return (
        <DashboardPageLayout
            title="Job Openings"
            subtitle="Create and manage your company's job postings"
        >
            <AnimatePresence>
                {createMode && (
                    <CreateJobForm
                        createState={createState}
                        setCreateState={setCreateState}
                        interviewState={interviewState}
                        setInterviewState={setInterviewState}
                        interviewDurations={interviewDurations}
                        setInterviewDurations={setInterviewDurations}
                        createSubmitting={createSubmitting}
                        onSubmit={handleCreateJob}
                        onCancel={() => {
                            setCreateMode(false);
                            resetCreateForm();
                        }}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {error && (
                    <motion.div
                        className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 text-red-700 text-sm"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={springEnter}
                    >
                        {error}
                    </motion.div>
                )}
            </AnimatePresence>

            {loading || editingJobId ? (
                <div className="flex items-center justify-center py-20">
                    <SfinxSpinner
                        size="lg"
                        title={editingJobId ? "Opening Job" : "Loading Jobs"}
                        messages={
                            editingJobId
                                ? "Preparing job editor..."
                                : "Fetching your job openings..."
                        }
                    />
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Bento Stats */}
                    {jobs.length > 0 && (
                        <BentoStats
                            totalJobs={jobs.length}
                            activeCount={jobs.length}
                            withInterview={withInterview}
                            avgCompletePct={avgCompletePct}
                        />
                    )}

                    {/* Section heading */}
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                        Your Positions
                    </h3>

                    {/* Jobs grid */}
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
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No job postings yet</h3>
                            <p className="text-gray-500 mb-4">Create your first position to start screening candidates</p>
                        </motion.div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {jobs.map((job, index) => (
                                <JobCard
                                    key={job.id}
                                    job={job}
                                    rawJob={job}
                                    index={index}
                                    deleteInFlight={deleteInFlight === job.id}
                                    onClick={() => {
                                        router.push(`/company-dashboard/applicants/${job.id}`);
                                    }}
                                    onEdit={(e) => {
                                        e.stopPropagation();
                                        setEditingJobId(job.id);
                                        router.push(
                                            `/company-dashboard/jobs/${encodeURIComponent(job.id)}`
                                        );
                                    }}
                                    onDelete={(e) => {
                                        e.stopPropagation();
                                        void handleDeleteJob(job.id);
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </DashboardPageLayout>
    );
}

// ── Page export ────────────────────────────────────────────────────────────
export default function CompanyJobsPage() {
    return (
        <AuthGuard requiredRole="COMPANY">
            <CompanyJobsContent />
        </AuthGuard>
    );
}
