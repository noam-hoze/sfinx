"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGuard } from "app/shared/components";
import { log } from "app/shared/services";
import { readResponseError } from "app/shared/utils/http";

interface JobDetailResponse {
    id: string;
    title: string;
    location: string;
    type: string;
    salary: string | null;
    description: string | null;
    requirements: string | null;
    company: {
        id: string;
        name: string;
        industry: string;
        size: string;
    };
    interviewContent: null | {
        id: string;
        backgroundQuestion: string | null;
        codingPrompt: string;
        codingTemplate: string | null;
        codingAnswer: string | null;
    };
}

interface FormState {
    title: string;
    location: string;
    type: string;
    salary: string;
    description: string;
    requirements: string;
}

interface InterviewState {
    backgroundQuestion: string;
    codingPrompt: string;
    codingTemplate: string;
    codingAnswer: string;
}

const emptyInterviewState: InterviewState = {
    backgroundQuestion: "",
    codingPrompt: "",
    codingTemplate: "",
    codingAnswer: "",
};

function optionalString(value: string | null | undefined): string {
    if (typeof value === "string") {
        return value;
    }
    return "";
}

function CompanyJobDetailContent() {
    const params = useParams<{ jobId: string }>();
    const jobId = params.jobId;
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [job, setJob] = useState<JobDetailResponse | null>(null);
    const [formState, setFormState] = useState<FormState>({
        title: "",
        location: "",
        type: "",
        salary: "",
        description: "",
        requirements: "",
    });
    const [interviewState, setInterviewState] =
        useState<InterviewState>(emptyInterviewState);
    const [saving, setSaving] = useState(false);
    const [removingInterview, setRemovingInterview] = useState(false);

    useEffect(() => {
        const fetchDetail = async () => {
            try {
                const resp = await fetch(`/api/company/jobs/${jobId}`);
                if (!resp.ok) {
                    const detail = await readResponseError(resp);
                    throw new Error(
                        `Failed to load job: ${resp.status} ${detail}`
                    );
                }
                const data = (await resp.json()) as JobDetailResponse;
                setJob(data);
                setFormState({
                    title: data.title,
                    location: data.location,
                    type: data.type,
                    salary: optionalString(data.salary),
                    description: optionalString(data.description),
                    requirements: optionalString(data.requirements),
                });
                if (data.interviewContent) {
                    setInterviewState({
                        backgroundQuestion:
                            optionalString(
                                data.interviewContent.backgroundQuestion
                            ),
                        codingPrompt: data.interviewContent.codingPrompt,
                        codingTemplate:
                            optionalString(
                                data.interviewContent.codingTemplate
                            ),
                        codingAnswer: optionalString(
                            data.interviewContent.codingAnswer
                        ),
                    });
                } else {
                    setInterviewState(emptyInterviewState);
                }
                setError(null);
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : "Unknown error";
                setError(message);
                log.error("❌ Failed to load company job detail:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchDetail().catch((err) => {
            log.error("❌ Unexpected job detail fetch error:", err);
        });
    }, [jobId]);

    const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSaving(true);
        try {
            const payload: any = {
                title: formState.title,
                location: formState.location,
                type: formState.type,
                salary: formState.salary.length > 0 ? formState.salary : null,
                description:
                    formState.description.length > 0
                        ? formState.description
                        : null,
                requirements:
                    formState.requirements.length > 0
                        ? formState.requirements
                        : null,
            };
            const hasInterviewContent =
                interviewState.backgroundQuestion.trim().length > 0 ||
                interviewState.codingPrompt.trim().length > 0 ||
                interviewState.codingTemplate.trim().length > 0 ||
                interviewState.codingAnswer.trim().length > 0;
            if (hasInterviewContent) {
                payload.interviewContent = {
                    backgroundQuestion: interviewState.backgroundQuestion,
                    codingPrompt: interviewState.codingPrompt,
                    codingTemplate:
                        interviewState.codingTemplate.length > 0
                            ? interviewState.codingTemplate
                            : null,
                    codingAnswer:
                        interviewState.codingAnswer.length > 0
                            ? interviewState.codingAnswer
                            : null,
                };
            } else {
                payload.interviewContent = null;
            }

            const resp = await fetch(`/api/company/jobs/${jobId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });
            if (!resp.ok) {
                const detail = await readResponseError(resp);
                throw new Error(`Failed to save job: ${resp.status} ${detail}`);
            }
            const updated = (await resp.json()) as JobDetailResponse;
            setJob(updated);
            setFormState({
                title: updated.title,
                location: updated.location,
                type: updated.type,
                salary: optionalString(updated.salary),
                description: optionalString(updated.description),
                requirements: optionalString(updated.requirements),
            });
            if (updated.interviewContent) {
                setInterviewState({
                    backgroundQuestion:
                        optionalString(
                            updated.interviewContent.backgroundQuestion
                        ),
                    codingPrompt: updated.interviewContent.codingPrompt,
                    codingTemplate:
                        optionalString(
                            updated.interviewContent.codingTemplate
                        ),
                    codingAnswer: optionalString(
                        updated.interviewContent.codingAnswer
                    ),
                });
            } else {
                setInterviewState(emptyInterviewState);
            }
            setError(null);
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Unknown error";
            setError(message);
            log.error("❌ Failed to save company job:", err);
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveInterviewContent = async () => {
        setRemovingInterview(true);
        try {
            const resp = await fetch(`/api/company/jobs/${jobId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ interviewContent: null }),
            });
            if (!resp.ok) {
                const detail = await readResponseError(resp);
                throw new Error(
                    `Failed to remove interview content: ${resp.status} ${detail}`
                );
            }
            const updated = (await resp.json()) as JobDetailResponse;
            setJob(updated);
            setInterviewState(emptyInterviewState);
            setError(null);
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Unknown error";
            setError(message);
            log.error("❌ Failed to remove interview content:", err);
        } finally {
            setRemovingInterview(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="max-w-4xl mx-auto p-6">
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <p className="mt-4 text-gray-600">Loading job...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!job) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="max-w-4xl mx-auto p-6">
                    {error ? (
                        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 text-red-700">
                            {error}
                        </div>
                    ) : null}
                    <Link
                        href="/company-dashboard/jobs"
                        className="text-blue-600 hover:text-blue-700"
                    >
                        Back to jobs
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <p className="text-sm text-blue-600">
                            {job.company.name}
                        </p>
                        <h1 className="text-3xl font-semibold text-gray-800">
                            {job.title}
                        </h1>
                        <p className="text-gray-500 mt-1">
                            {job.location} • {job.type}
                        </p>
                    </div>
                    <Link
                        href="/company-dashboard/jobs"
                        className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                        Back
                    </Link>
                </div>

                {error ? (
                    <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 text-red-700">
                        {error}
                    </div>
                ) : null}

                <form
                    className="space-y-8"
                    onSubmit={handleSave}
                    noValidate
                >
                    <section className="bg-white/80 backdrop-blur rounded-2xl border border-white/20 p-6 shadow-sm">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">
                            Job Details
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className="flex flex-col text-sm font-medium text-gray-700">
                                Title
                                <input
                                    value={formState.title}
                                    onChange={(event) =>
                                        setFormState((prev) => ({
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
                                    value={formState.location}
                                    onChange={(event) =>
                                        setFormState((prev) => ({
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
                                    value={formState.type}
                                    onChange={(event) =>
                                        setFormState((prev) => ({
                                            ...prev,
                                            type: event.target.value,
                                        }))
                                    }
                                    className="mt-1 rounded-xl border border-gray-200 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                    required
                                />
                            </label>
                            <label className="flex flex-col text-sm font-medium text-gray-700">
                                Salary
                                <input
                                    value={formState.salary}
                                    onChange={(event) =>
                                        setFormState((prev) => ({
                                            ...prev,
                                            salary: event.target.value,
                                        }))
                                    }
                                    className="mt-1 rounded-xl border border-gray-200 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                    placeholder="$160k - $230k"
                                />
                            </label>
                            <label className="flex flex-col text-sm font-medium text-gray-700 md:col-span-2">
                                Description
                                <textarea
                                    value={formState.description}
                                    onChange={(event) =>
                                        setFormState((prev) => ({
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
                                    value={formState.requirements}
                                    onChange={(event) =>
                                        setFormState((prev) => ({
                                            ...prev,
                                            requirements: event.target.value,
                                        }))
                                    }
                                    className="mt-1 rounded-xl border border-gray-200 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all min-h-[120px]"
                                />
                            </label>
                        </div>
                    </section>

                    <section className="bg-white/80 backdrop-blur rounded-2xl border border-white/20 p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-gray-800">
                                Interview Content
                            </h2>
                            <button
                                type="button"
                                className="text-sm text-red-600 hover:text-red-700 disabled:opacity-60"
                                onClick={handleRemoveInterviewContent}
                                disabled={
                                    removingInterview ||
                                    (interviewState.backgroundQuestion.trim()
                                        .length === 0 &&
                                        interviewState.codingPrompt.trim()
                                            .length === 0 &&
                                        interviewState.codingTemplate.trim()
                                            .length === 0 &&
                                        interviewState.codingAnswer.trim()
                                            .length === 0)
                                }
                            >
                                {removingInterview
                                    ? "Removing..."
                                    : "Remove content"}
                            </button>
                        </div>
                        <div className="space-y-4">
                            <label className="flex flex-col text-sm font-medium text-gray-700">
                                Background Question
                                <textarea
                                    value={interviewState.backgroundQuestion}
                                    onChange={(event) =>
                                        setInterviewState((prev) => ({
                                            ...prev,
                                            backgroundQuestion:
                                                event.target.value,
                                        }))
                                    }
                                    className="mt-1 rounded-xl border border-gray-200 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all min-h-[100px]"
                                />
                            </label>
                            <label className="flex flex-col text-sm font-medium text-gray-700">
                                Coding Prompt
                                <textarea
                                    value={interviewState.codingPrompt}
                                    onChange={(event) =>
                                        setInterviewState((prev) => ({
                                            ...prev,
                                            codingPrompt: event.target.value,
                                        }))
                                    }
                                    className="mt-1 rounded-xl border border-gray-200 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all min-h-[140px]"
                                    required
                                />
                            </label>
                            <label className="flex flex-col text-sm font-medium text-gray-700">
                                Coding Template
                                <textarea
                                    value={interviewState.codingTemplate}
                                    onChange={(event) =>
                                        setInterviewState((prev) => ({
                                            ...prev,
                                            codingTemplate: event.target.value,
                                        }))
                                    }
                                    className="mt-1 rounded-xl border border-gray-200 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all min-h-[140px]"
                                />
                            </label>
                            <label className="flex flex-col text-sm font-medium text-gray-700">
                                Reference Answer
                                <textarea
                                    value={interviewState.codingAnswer}
                                    onChange={(event) =>
                                        setInterviewState((prev) => ({
                                            ...prev,
                                            codingAnswer: event.target.value,
                                        }))
                                    }
                                    className="mt-1 rounded-xl border border-gray-200 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all min-h-[140px]"
                                />
                            </label>
                        </div>
                    </section>

                    <div className="flex justify-end gap-3">
                        <Link
                            href="/company-dashboard/jobs"
                            className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
                            disabled={saving}
                        >
                            {saving ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function CompanyJobDetailPage() {
    return (
        <AuthGuard requiredRole="COMPANY">
            <CompanyJobDetailContent />
        </AuthGuard>
    );
}

