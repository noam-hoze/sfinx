"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { AuthGuard, DashboardPageLayout, DashboardCard } from "app/shared/components";
import SfinxSpinner from "app/shared/components/SfinxSpinner";
import { log } from "app/shared/services";
import { JobGrid, JobGridJob } from "app/shared/components/jobs/JobGrid";
import type { JobGridCompany } from "app/shared/components/jobs/JobGrid";
import { readResponseError } from "app/shared/utils/http";
import InterviewContentSection, {

const LOG_CATEGORY = "company-dashboard";
    InterviewContentState,
    InterviewDurationState,
    defaultInterviewDurations,
    emptyInterviewContentState,
} from "./components/InterviewContentSection";

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

function CompanyJobsContent() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [jobs, setJobs] = useState<JobGridJob[]>([]);
    const [createMode, setCreateMode] = useState(false);
    const [companyName, setCompanyName] = useState<string>("");
    const [createState, setCreateState] =
        useState<CreateJobState>(defaultCreateState);
    const [interviewState, setInterviewState] =
        useState<InterviewContentState>(emptyInterviewContentState);
    const [interviewDurations, setInterviewDurations] =
        useState<InterviewDurationState>(defaultInterviewDurations);
    const [createSubmitting, setCreateSubmitting] = useState(false);
    const [deleteInFlight, setDeleteInFlight] = useState<string | null>(null);
    const [editingJobId, setEditingJobId] = useState<string | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('create') === 'true') {
            setCreateMode(true);
            // Remove the param from URL
            params.delete('create');
            const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
            window.history.replaceState({}, '', newUrl);
        }
    }, []);

    useEffect(() => {
        const fetchJobs = async () => {
            log.info(LOG_CATEGORY, "Fetching company jobs...");
            try {
                const resp = await fetch("/api/company/jobs");
                if (!resp.ok) {
                    const detail = await readResponseError(resp);
                    throw new Error(
                        `Failed to load company jobs: ${resp.status} ${detail}`
                    );
                }
                const data = (await resp.json()) as CompanyJobsResponse;
                if (!data.company) {
                    throw new Error("Response missing company data");
                }
                setCompanyName(data.company.name);
                setJobs(
                    data.jobs.map((job) => {
                        const description =
                            typeof job.description === "string"
                                ? job.description
                                : null;
                        return {
                            id: job.id,
                            title: job.title,
                            location: job.location,
                            type: job.type,
                            description,
                            company: {
                                id: data.company.id,
                                name: data.company.name,
                                logo: null,
                                industry: data.company.industry,
                                size: data.company.size,
                            },
                        };
                    })
                );
                setError(null);
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : "Unknown error";
                log.error(LOG_CATEGORY, "❌ Failed to fetch company jobs:", err);
                setError(message);
            } finally {
                setLoading(false);
            }
        };
        fetchJobs().catch((err) => {
            log.error(LOG_CATEGORY, "❌ Unexpected fetch error:", err);
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

            if (
                hasInterviewContent &&
                interviewState.codingPrompt.trim().length === 0
            ) {
                setError(
                    "Coding prompt is required when adding interview content."
                );
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
                    backgroundQuestionTimeSeconds:
                        interviewDurations.backgroundSeconds,
                    codingQuestionTimeSeconds: interviewDurations.codingSeconds,
                };
            }

            const resp = await fetch("/api/company/jobs", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });
            if (!resp.ok) {
                const detail = await readResponseError(resp);
                throw new Error(
                    `Failed to create job: ${resp.status} ${detail}`
                );
            }
            const created = (await resp.json()) as CompanyJobsResponse["jobs"][number];
            setJobs((prev) => [
                {
                    id: created.id,
                    title: created.title,
                    location: created.location,
                    type: created.type,
                    description:
                        typeof created.description === "string"
                            ? created.description
                            : null,
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
            const message =
                err instanceof Error ? err.message : "Unknown error";
            setError(message);
            log.error(LOG_CATEGORY, "❌ Failed to create job:", err);
        } finally {
            setCreateSubmitting(false);
        }
    };

    const handleDeleteJob = async (jobId: string) => {
        setDeleteInFlight(jobId);
        try {
            const resp = await fetch(`/api/company/jobs/${jobId}`, {
                method: "DELETE",
            });
            if (!resp.ok) {
                const detail = await readResponseError(resp);
                throw new Error(
                    `Failed to delete job: ${resp.status} ${detail}`
                );
            }
            setJobs((prev) => prev.filter((job) => job.id !== jobId));
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Unknown error";
            setError(message);
            log.error(LOG_CATEGORY, "❌ Failed to delete job:", err);
        } finally {
            setDeleteInFlight(null);
        }
    };

    return (
        <DashboardPageLayout
            title="Job Openings"
            subtitle="Create and edit your company's job postings"
        >

                {createMode && (
                    <form
                        className="bg-white/80 backdrop-blur rounded-2xl border border-white/20 p-6 mb-8 shadow-sm"
                        onSubmit={handleCreateJob}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-gray-800">
                                New Job
                            </h2>
                            <button
                                type="button"
                                className="text-sm text-gray-500 hover:text-gray-700"
                                onClick={() => {
                                    setCreateMode(false);
                                    resetCreateForm();
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className="flex flex-col text-sm font-medium text-gray-700">
                                Title
                                <input
                                    value={createState.title}
                                    onChange={(event) =>
                                        setCreateState((prev) => ({
                                            ...prev,
                                            title: event.target.value,
                                        }))
                                    }
                                    className="mt-1 rounded-xl border border-gray-200 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                    required
                                />
                            </label>
                            <label className="flex flex-col text-sm font-medium text-gray-700">
                                Location
                                <input
                                    value={createState.location}
                                    onChange={(event) =>
                                        setCreateState((prev) => ({
                                            ...prev,
                                            location: event.target.value,
                                        }))
                                    }
                                    className="mt-1 rounded-xl border border-gray-200 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                    required
                                />
                            </label>
                            <label className="flex flex-col text-sm font-medium text-gray-700">
                                Type
                                <input
                                    value={createState.type}
                                    onChange={(event) =>
                                        setCreateState((prev) => ({
                                            ...prev,
                                            type: event.target.value,
                                        }))
                                    }
                                    className="mt-1 rounded-xl border border-gray-200 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                    placeholder="e.g. full-time"
                                    required
                                />
                            </label>
                            <label className="flex flex-col text-sm font-medium text-gray-700">
                                Salary
                                <input
                                    value={createState.salary}
                                    onChange={(event) =>
                                        setCreateState((prev) => ({
                                            ...prev,
                                            salary: event.target.value,
                                        }))
                                    }
                                    className="mt-1 rounded-xl border border-gray-200 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                    placeholder="$150k - $200k"
                                />
                            </label>
                            <label className="flex flex-col text-sm font-medium text-gray-700 md:col-span-2">
                                Description
                                <textarea
                                    value={createState.description}
                                    onChange={(event) =>
                                        setCreateState((prev) => ({
                                            ...prev,
                                            description: event.target.value,
                                        }))
                                    }
                                    className="mt-1 rounded-xl border border-gray-200 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all min-h-[120px]"
                                />
                            </label>
                            <label className="flex flex-col text-sm font-medium text-gray-700 md:col-span-2">
                                Requirements
                                <textarea
                                    value={createState.requirements}
                                    onChange={(event) =>
                                        setCreateState((prev) => ({
                                            ...prev,
                                            requirements: event.target.value,
                                        }))
                                    }
                                    className="mt-1 rounded-xl border border-gray-200 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all min-h-[120px]"
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
                                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
                                onClick={() => {
                                    setCreateMode(false);
                                    setCreateState(defaultCreateState);
                                }}
                                disabled={createSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
                                disabled={createSubmitting}
                            >
                                {createSubmitting ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </form>
                )}

                {error ? (
                    <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 text-red-700">
                        {error}
                    </div>
                ) : null}

                {loading || editingJobId ? (
                    <div className="flex items-center justify-center py-12">
                        <SfinxSpinner 
                            size="lg"
                            title={editingJobId ? "Opening Job" : "Loading Jobs"} 
                            messages={editingJobId ? "Preparing job editor..." : "Fetching your job openings..."} 
                        />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {jobs.map((job) => (
                            <DashboardCard
                                key={job.id}
                                className="group flex flex-col relative"
                            >
                                <div className="absolute top-4 right-4 flex gap-2 z-10">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteJob(job.id);
                                        }}
                                        disabled={deleteInFlight === job.id}
                                        className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-60"
                                        title="Delete"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingJobId(job.id);
                                        router.push(`/company-dashboard/jobs/${encodeURIComponent(job.id)}`);
                                    }}
                                    className="text-left w-full"
                                >
                                    <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors pr-16">{job.title}</h3>
                                </button>
                            </DashboardCard>
                        ))}
                    </div>
                )}
        </DashboardPageLayout>
    );
}

export default function CompanyJobsPage() {
    return (
        <AuthGuard requiredRole="COMPANY">
            <CompanyJobsContent />
        </AuthGuard>
    );
}

