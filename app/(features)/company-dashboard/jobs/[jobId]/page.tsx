"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGuard } from "app/shared/components";
import { log } from "app/shared/services";
import { readResponseError } from "app/shared/utils/http";
import InterviewContentSection, {
    InterviewContentState,
    InterviewDurationState,
    defaultInterviewDurations,
    emptyInterviewContentState,
} from "../components/InterviewContentSection";

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
        backgroundQuestionTimeSeconds: number;
        codingQuestionTimeSeconds: number;
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

interface ScoringConfigState {
    adaptabilityWeight: number;
    creativityWeight: number;
    reasoningWeight: number;
    codeQualityWeight: number;
    problemSolvingWeight: number;
    independenceWeight: number;
    iterationSpeedWeight: number;
    aiAssistWeight: number;
    experienceWeight: number;
    codingWeight: number;
    iterationSpeedThresholdModerate: number;
    iterationSpeedThresholdHigh: number;
}

const defaultScoringConfig: ScoringConfigState = {
    adaptabilityWeight: 33.33,
    creativityWeight: 33.33,
    reasoningWeight: 33.34,
    codeQualityWeight: 25,
    problemSolvingWeight: 25,
    independenceWeight: 25,
    iterationSpeedWeight: 12.5,
    aiAssistWeight: 12.5,
    experienceWeight: 50,
    codingWeight: 50,
    iterationSpeedThresholdModerate: 5,
    iterationSpeedThresholdHigh: 10,
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
        useState<InterviewContentState>(emptyInterviewContentState);
    const [interviewDurations, setInterviewDurations] =
        useState<InterviewDurationState>(defaultInterviewDurations);
    const [saving, setSaving] = useState(false);
    const [removingInterview, setRemovingInterview] = useState(false);
    const [scoringConfig, setScoringConfig] = useState<ScoringConfigState>(defaultScoringConfig);
    const [scoringExpanded, setScoringExpanded] = useState(false);
    const [savingScoring, setSavingScoring] = useState(false);

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
                        backgroundQuestion: optionalString(
                            data.interviewContent.backgroundQuestion
                        ),
                        codingPrompt: data.interviewContent.codingPrompt,
                        codingTemplate: optionalString(
                            data.interviewContent.codingTemplate
                        ),
                        codingAnswer: optionalString(
                            data.interviewContent.codingAnswer
                        ),
                    });
                    const backgroundSecondsRaw = Number(
                        data.interviewContent.backgroundQuestionTimeSeconds
                    );
                    const codingSecondsRaw = Number(
                        data.interviewContent.codingQuestionTimeSeconds
                    );
                    setInterviewDurations({
                        backgroundSeconds:
                            Number.isFinite(backgroundSecondsRaw) &&
                            backgroundSecondsRaw > 0
                                ? Math.floor(backgroundSecondsRaw)
                                : defaultInterviewDurations.backgroundSeconds,
                        codingSeconds:
                            Number.isFinite(codingSecondsRaw) &&
                            codingSecondsRaw > 0
                                ? Math.floor(codingSecondsRaw)
                                : defaultInterviewDurations.codingSeconds,
                    });
                } else {
                    setInterviewState(emptyInterviewContentState);
                    setInterviewDurations(defaultInterviewDurations);
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

    useEffect(() => {
        const fetchScoringConfig = async () => {
            try {
                const resp = await fetch(`/api/company/jobs/${jobId}/scoring-config`);
                if (resp.ok) {
                    const data = await resp.json();
                    if (data.config) {
                        setScoringConfig(data.config);
                    }
                }
            } catch (err) {
                log.error("❌ Failed to load scoring configuration:", err);
            }
        };
        fetchScoringConfig();
    }, [jobId]);

    const handleScoringConfigSave = async () => {
        setSavingScoring(true);
        try {
            const resp = await fetch(`/api/company/jobs/${jobId}/scoring-config`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(scoringConfig),
            });
            if (!resp.ok) {
                const detail = await readResponseError(resp);
                throw new Error(`Failed to save scoring configuration: ${resp.status} ${detail}`);
            }
            log.info("✅ Scoring configuration saved");
        } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            setError(message);
            log.error("❌ Failed to save scoring configuration:", err);
        } finally {
            setSavingScoring(false);
        }
    };

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
                    backgroundQuestionTimeSeconds:
                        interviewDurations.backgroundSeconds,
                    codingQuestionTimeSeconds: interviewDurations.codingSeconds,
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
                const backgroundSecondsRaw = Number(
                    updated.interviewContent.backgroundQuestionTimeSeconds
                );
                const codingSecondsRaw = Number(
                    updated.interviewContent.codingQuestionTimeSeconds
                );
                setInterviewDurations({
                    backgroundSeconds:
                        Number.isFinite(backgroundSecondsRaw) &&
                        backgroundSecondsRaw > 0
                            ? Math.floor(backgroundSecondsRaw)
                            : defaultInterviewDurations.backgroundSeconds,
                    codingSeconds:
                        Number.isFinite(codingSecondsRaw) &&
                        codingSecondsRaw > 0
                            ? Math.floor(codingSecondsRaw)
                            : defaultInterviewDurations.codingSeconds,
                });
            } else {
                setInterviewState(emptyInterviewContentState);
                setInterviewDurations(defaultInterviewDurations);
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
            setInterviewState(emptyInterviewContentState);
            setInterviewDurations(defaultInterviewDurations);
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

                    <InterviewContentSection
                        state={interviewState}
                        onChange={setInterviewState}
                        durations={interviewDurations}
                        onDurationChange={setInterviewDurations}
                        disabled={saving || removingInterview}
                        onRemove={handleRemoveInterviewContent}
                        canRemove={
                            !(
                                interviewState.backgroundQuestion.trim().length === 0 &&
                                interviewState.codingPrompt.trim().length === 0 &&
                                interviewState.codingTemplate.trim().length === 0 &&
                                interviewState.codingAnswer.trim().length === 0
                            )
                        }
                        removing={removingInterview}
                        subtitle="Adjust the background conversation, coding prompt, and timers associated with this job."
                    />

                    {/* Scoring Configuration Section */}
                    <section className="bg-white/80 backdrop-blur rounded-2xl border border-white/20 p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-800">
                                    Scoring Configuration
                                </h2>
                                <p className="text-sm text-gray-600 mt-1">
                                    Configure weights and benchmarks for candidate evaluation
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setScoringExpanded(!scoringExpanded)}
                                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                                {scoringExpanded ? "Collapse" : "Expand"}
                            </button>
                        </div>

                        {scoringExpanded && (
                            <div className="space-y-6">
                                {/* Category Weights */}
                                <div className="border-t border-gray-200 pt-4">
                                    <h3 className="text-lg font-medium text-gray-800 mb-3">
                                        Category Weights
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <label className="flex flex-col text-sm font-medium text-gray-700">
                                            Experience Weight (%)
                                            <input
                                                type="number"
                                                value={scoringConfig.experienceWeight}
                                                onChange={(e) => setScoringConfig({
                                                    ...scoringConfig,
                                                    experienceWeight: Number(e.target.value)
                                                })}
                                                className="mt-1 rounded-xl border border-gray-200 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                            />
                                        </label>
                                        <label className="flex flex-col text-sm font-medium text-gray-700">
                                            Coding Weight (%)
                                            <input
                                                type="number"
                                                value={scoringConfig.codingWeight}
                                                onChange={(e) => setScoringConfig({
                                                    ...scoringConfig,
                                                    codingWeight: Number(e.target.value)
                                                })}
                                                className="mt-1 rounded-xl border border-gray-200 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                            />
                                        </label>
                                    </div>
                                    {Math.abs((scoringConfig.experienceWeight + scoringConfig.codingWeight) - 100) > 0.01 && (
                                        <p className="text-sm text-red-600 mt-2">
                                            ⚠️ Category weights must sum to 100
                                        </p>
                                    )}
                                </div>

                                {/* Experience Dimensions */}
                                <div className="border-t border-gray-200 pt-4">
                                    <h3 className="text-lg font-medium text-gray-800 mb-3">
                                        Experience Dimensions
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <label className="flex flex-col text-sm font-medium text-gray-700">
                                            Adaptability Weight
                                            <input
                                                type="number"
                                                value={scoringConfig.adaptabilityWeight}
                                                onChange={(e) => setScoringConfig({
                                                    ...scoringConfig,
                                                    adaptabilityWeight: Number(e.target.value)
                                                })}
                                                className="mt-1 rounded-xl border border-gray-200 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                            />
                                        </label>
                                        <label className="flex flex-col text-sm font-medium text-gray-700">
                                            Creativity Weight
                                            <input
                                                type="number"
                                                value={scoringConfig.creativityWeight}
                                                onChange={(e) => setScoringConfig({
                                                    ...scoringConfig,
                                                    creativityWeight: Number(e.target.value)
                                                })}
                                                className="mt-1 rounded-xl border border-gray-200 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                            />
                                        </label>
                                        <label className="flex flex-col text-sm font-medium text-gray-700">
                                            Reasoning Weight
                                            <input
                                                type="number"
                                                value={scoringConfig.reasoningWeight}
                                                onChange={(e) => setScoringConfig({
                                                    ...scoringConfig,
                                                    reasoningWeight: Number(e.target.value)
                                                })}
                                                className="mt-1 rounded-xl border border-gray-200 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                            />
                                        </label>
                                    </div>
                                </div>

                                {/* Coding Dimensions */}
                                <div className="border-t border-gray-200 pt-4">
                                    <h3 className="text-lg font-medium text-gray-800 mb-3">
                                        Coding Dimensions
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <label className="flex flex-col text-sm font-medium text-gray-700">
                                            Code Quality Weight
                                            <input
                                                type="number"
                                                value={scoringConfig.codeQualityWeight}
                                                onChange={(e) => setScoringConfig({
                                                    ...scoringConfig,
                                                    codeQualityWeight: Number(e.target.value)
                                                })}
                                                className="mt-1 rounded-xl border border-gray-200 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                            />
                                        </label>
                                        <label className="flex flex-col text-sm font-medium text-gray-700">
                                            Problem Solving Weight
                                            <input
                                                type="number"
                                                value={scoringConfig.problemSolvingWeight}
                                                onChange={(e) => setScoringConfig({
                                                    ...scoringConfig,
                                                    problemSolvingWeight: Number(e.target.value)
                                                })}
                                                className="mt-1 rounded-xl border border-gray-200 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                            />
                                        </label>
                                        <label className="flex flex-col text-sm font-medium text-gray-700">
                                            Independence Weight
                                            <input
                                                type="number"
                                                value={scoringConfig.independenceWeight}
                                                onChange={(e) => setScoringConfig({
                                                    ...scoringConfig,
                                                    independenceWeight: Number(e.target.value)
                                                })}
                                                className="mt-1 rounded-xl border border-gray-200 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                            />
                                        </label>
                                    </div>
                                </div>

                                {/* Workstyle Metrics */}
                                <div className="border-t border-gray-200 pt-4">
                                    <h3 className="text-lg font-medium text-gray-800 mb-3">
                                        Workstyle Metrics
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                        <label className="flex flex-col text-sm font-medium text-gray-700">
                                            Iteration Speed Weight
                                            <input
                                                type="number"
                                                value={scoringConfig.iterationSpeedWeight}
                                                onChange={(e) => setScoringConfig({
                                                    ...scoringConfig,
                                                    iterationSpeedWeight: Number(e.target.value)
                                                })}
                                                className="mt-1 rounded-xl border border-gray-200 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                            />
                                        </label>
                                        <label className="flex flex-col text-sm font-medium text-gray-700">
                                            AI Assist Weight
                                            <input
                                                type="number"
                                                value={scoringConfig.aiAssistWeight}
                                                onChange={(e) => setScoringConfig({
                                                    ...scoringConfig,
                                                    aiAssistWeight: Number(e.target.value)
                                                })}
                                                className="mt-1 rounded-xl border border-gray-200 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                            />
                                        </label>
                                    </div>
                                    
                                    <h4 className="text-md font-medium text-gray-700 mb-3">Benchmarks</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <label className="flex flex-col text-sm font-medium text-gray-700">
                                            Iteration Speed - Moderate Threshold
                                            <input
                                                type="number"
                                                value={scoringConfig.iterationSpeedThresholdModerate}
                                                onChange={(e) => setScoringConfig({
                                                    ...scoringConfig,
                                                    iterationSpeedThresholdModerate: Number(e.target.value)
                                                })}
                                                className="mt-1 rounded-xl border border-gray-200 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                            />
                                        </label>
                                        <label className="flex flex-col text-sm font-medium text-gray-700">
                                            Iteration Speed - High Threshold
                                            <input
                                                type="number"
                                                value={scoringConfig.iterationSpeedThresholdHigh}
                                                onChange={(e) => setScoringConfig({
                                                    ...scoringConfig,
                                                    iterationSpeedThresholdHigh: Number(e.target.value)
                                                })}
                                                className="mt-1 rounded-xl border border-gray-200 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                            />
                                        </label>
                                    </div>
                                </div>

                                {/* Save Button */}
                                <div className="flex justify-end pt-4 border-t border-gray-200">
                                    <button
                                        type="button"
                                        onClick={handleScoringConfigSave}
                                        className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
                                        disabled={savingScoring}
                                    >
                                        {savingScoring ? "Saving..." : "Save Scoring Configuration"}
                                    </button>
                                </div>
                            </div>
                        )}
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

