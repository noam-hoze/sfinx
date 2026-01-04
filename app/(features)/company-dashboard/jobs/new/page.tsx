"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthGuard } from "app/shared/components";
import { log } from "app/shared/services";
import { readResponseError } from "app/shared/utils/http";
import InterviewContentSection, {
    InterviewContentState,
    InterviewDurationState,
    defaultInterviewDurations,
    emptyInterviewContentState,
} from "../components/InterviewContentSection";

interface CreateJobState {
    title: string;
    location: string;
    type: string;
    salary: string;
    description: string;
    requirements: string;
}

interface CodingCategory {
    name: string;
    description: string;
    weight: number;
}

interface ScoringConfigState {
    adaptabilityWeight: number;
    creativityWeight: number;
    reasoningWeight: number;
    aiAssistWeight: number;
    experienceWeight: number;
    codingWeight: number;
}

const defaultCreateState: CreateJobState = {
    title: "",
    location: "",
    type: "",
    salary: "",
    description: "",
    requirements: "",
};

const defaultScoringConfig: ScoringConfigState = {
    adaptabilityWeight: 33.33,
    creativityWeight: 33.33,
    reasoningWeight: 33.34,
    aiAssistWeight: 25,
    experienceWeight: 50,
    codingWeight: 50,
};

function CreateJobContent() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [createState, setCreateState] = useState<CreateJobState>(defaultCreateState);
    const [interviewState, setInterviewState] = useState<InterviewContentState>(emptyInterviewContentState);
    const [interviewDurations, setInterviewDurations] = useState<InterviewDurationState>(defaultInterviewDurations);
    const [createSubmitting, setCreateSubmitting] = useState(false);
    const [scoringConfig, setScoringConfig] = useState<ScoringConfigState>(defaultScoringConfig);
    const [codingCategories, setCodingCategories] = useState<CodingCategory[]>([]);
    const [activeSection, setActiveSection] = useState<string>("details");
    const [expandedSections, setExpandedSections] = useState<string[]>(["details"]);
    const [interviewTab, setInterviewTab] = useState<'experience' | 'coding'>('experience');

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

            const payload: any = {
                title: createState.title,
                location: createState.location,
                type: createState.type,
                salary: createState.salary.length > 0 ? createState.salary : null,
                description: createState.description.length > 0 ? createState.description : null,
                requirements: createState.requirements.length > 0 ? createState.requirements : null,
                codingCategories: codingCategories.length > 0 ? codingCategories : null,
                scoringConfig,
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
            
            log.info("Job created successfully");
            router.push("/company-dashboard/jobs");
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Unknown error";
            setError(message);
            log.error("❌ Failed to create job:", err);
        } finally {
            setCreateSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <div className="w-64 bg-white border-r border-gray-200 sticky top-0 h-screen flex flex-col">
                <div className="p-6 border-b border-gray-200">
                    <Link
                        href="/company-dashboard/jobs"
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Jobs
                    </Link>
                </div>
                <nav className="flex-1 p-4 overflow-y-auto">
                    <div className="space-y-1">
                        {[
                            { 
                                id: "details", 
                                label: "Job Details",
                                subItems: [
                                    { id: "title", label: "Title" },
                                    { id: "location", label: "Location" },
                                    { id: "type", label: "Type" },
                                    { id: "salary", label: "Salary" },
                                    { id: "description", label: "Description" },
                                    { id: "requirements", label: "Requirements" },
                                ]
                            },
                            { 
                                id: "interview", 
                                label: "Interview Content",
                                subItems: [
                                    { id: "background-question", label: "Starter Question", tab: 'experience' as const },
                                    { id: "coding-prompt", label: "Coding Prompt", tab: 'coding' as const },
                                    { id: "coding-template", label: "Coding Template", tab: 'coding' as const },
                                    { id: "coding-answer", label: "Reference Answer", tab: 'coding' as const },
                                    { id: "expected-output", label: "Expected Output", tab: 'coding' as const },
                                ]
                            },
                            { 
                                id: "scoring", 
                                label: "Scoring Configuration",
                                subItems: [
                                    { id: "category-weights", label: "Category Weights" },
                                    { id: "experience-dimensions", label: "Experience Dimensions" },
                                    { id: "coding-dimensions", label: "Coding Dimensions" },
                                ]
                            },
                        ].map((section) => (
                            <div key={section.id}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setActiveSection(section.id);
                                        if (section.subItems) {
                                            setExpandedSections(prev => 
                                                prev.includes(section.id) 
                                                    ? prev.filter(s => s !== section.id)
                                                    : [...prev, section.id]
                                            );
                                        }
                                        document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                                    }}
                                    className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-lg text-sm transition-all ${
                                        activeSection === section.id
                                            ? "bg-blue-50 text-blue-600 font-medium"
                                            : "text-gray-700 hover:bg-gray-50 hover:text-gray-900 font-medium"
                                    }`}
                                >
                                    {section.label}
                                    {section.subItems && (
                                        <svg 
                                            className={`w-4 h-4 transition-transform ${expandedSections.includes(section.id) ? 'rotate-90' : ''}`}
                                            fill="none" 
                                            stroke="currentColor" 
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    )}
                                </button>
                                {expandedSections.includes(section.id) && section.subItems && (
                                    <div className="ml-3 mt-1 space-y-1 border-l border-gray-200 pl-3">
                                        {section.subItems.map((subItem: any) => (
                                            <button
                                                key={subItem.id}
                                                type="button"
                                                onClick={() => {
                                                    if (subItem.tab) {
                                                        setInterviewTab(subItem.tab);
                                                        setTimeout(() => {
                                                            const element = document.getElementById(subItem.id);
                                                            element?.scrollIntoView({ behavior: "smooth", block: "center" });
                                                            setTimeout(() => {
                                                                const input = element?.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement;
                                                                input?.focus();
                                                            }, 300);
                                                        }, 100);
                                                    } else {
                                                        const element = document.getElementById(subItem.id);
                                                        element?.scrollIntoView({ behavior: "smooth", block: "center" });
                                                        setTimeout(() => {
                                                            const input = element?.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement;
                                                            input?.focus();
                                                        }, 300);
                                                    }
                                                }}
                                                className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all"
                                            >
                                                {subItem.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto p-12">
                    <div className="mb-8">
                        <h1 className="text-3xl font-semibold text-gray-800">
                            Create New Job
                        </h1>
                        <p className="text-gray-600 mt-2">
                            Add a new job opening for your company
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 text-red-700">
                            {error}
                        </div>
                    )}

                    <form
                        className="space-y-8"
                        onSubmit={handleCreateJob}
                        noValidate
                    >
                        <section id="details" className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">
                                Job Details
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label id="title" className="flex flex-col text-sm font-medium text-gray-700 scroll-mt-24">
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
                                <label id="location" className="flex flex-col text-sm font-medium text-gray-700 scroll-mt-24">
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
                                <label id="type" className="flex flex-col text-sm font-medium text-gray-700 scroll-mt-24">
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
                                <label id="salary" className="flex flex-col text-sm font-medium text-gray-700 scroll-mt-24">
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
                                        placeholder="$160k - $230k"
                                    />
                                </label>
                                <label id="description" className="flex flex-col text-sm font-medium text-gray-700 md:col-span-2 scroll-mt-24">
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
                                <label id="requirements" className="flex flex-col text-sm font-medium text-gray-700 md:col-span-2 scroll-mt-24">
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
                        </section>

                        <section id="interview">
                            <InterviewContentSection
                                state={interviewState}
                                onChange={setInterviewState}
                                durations={interviewDurations}
                                onDurationChange={setInterviewDurations}
                                disabled={createSubmitting}
                                subtitle="Optional: configure the background conversation, coding prompt, and timers candidates will experience."
                                allowEmptyCodingPrompt={false}
                                activeTab={interviewTab}
                                onTabChange={setInterviewTab}
                            />
                        </section>

                        {/* Scoring Configuration Section */}
                        <section id="scoring" className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                            <div className="mb-6">
                                <h2 className="text-xl font-semibold text-gray-800">
                                    Scoring Configuration
                                </h2>
                                <p className="text-sm text-gray-600 mt-1">
                                    Configure weights and benchmarks for candidate evaluation
                                </p>
                            </div>

                            <div className="space-y-6">
                                {/* Category Weights */}
                                <div id="category-weights" className="border-t border-gray-200 pt-4 scroll-mt-24">
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
                                <div id="experience-dimensions" className="border-t border-gray-200 pt-4 scroll-mt-24">
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
                                <div id="coding-dimensions" className="border-t border-gray-200 pt-4 scroll-mt-24">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-1">
                                        Coding Dimensions
                                    </h3>
                                    <p className="text-xs text-gray-500 mb-6">
                                        Define evaluation criteria and weights for coding performance
                                    </p>

                                    {/* Job-Specific Categories */}
                                    <div className="mb-6">
                                        <h4 className="text-sm font-medium text-gray-700 mb-3">
                                            Job-Specific Categories
                                        </h4>
                                        
                                        <div className="space-y-3">
                                            {codingCategories.map((category, index) => (
                                                <div
                                                    key={index}
                                                    className="group relative bg-gray-50/50 border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-all"
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const updated = codingCategories.filter((_, i) => i !== index);
                                                            setCodingCategories(updated);
                                                        }}
                                                        className="absolute top-3 right-3 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                    
                                                    <div className="space-y-2 pr-6">
                                                        <input
                                                            type="text"
                                                            value={category.name}
                                                            onChange={(e) => {
                                                                const updated = [...codingCategories];
                                                                updated[index].name = e.target.value;
                                                                setCodingCategories(updated);
                                                            }}
                                                            placeholder="Category name (e.g., TypeScript Proficiency)"
                                                            className="w-full text-sm font-semibold text-gray-900 bg-transparent border-0 px-0 py-0 focus:ring-0 outline-none placeholder:text-gray-400 placeholder:font-normal"
                                                        />
                                                        
                                                        <input
                                                            type="text"
                                                            value={category.description}
                                                            onChange={(e) => {
                                                                const updated = [...codingCategories];
                                                                updated[index].description = e.target.value;
                                                                setCodingCategories(updated);
                                                            }}
                                                            placeholder="Description (e.g., Type safety, interfaces, generics)"
                                                            className="w-full text-xs text-gray-500 bg-transparent border-0 px-0 py-0 focus:ring-0 outline-none placeholder:text-gray-400"
                                                        />
                                                        
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-gray-500">Weight:</span>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="100"
                                                                value={category.weight}
                                                                onChange={(e) => {
                                                                    const updated = [...codingCategories];
                                                                    updated[index].weight = Number(e.target.value);
                                                                    setCodingCategories(updated);
                                                                }}
                                                                className="w-16 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded px-2 py-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none"
                                                            />
                                                            <span className="text-xs text-gray-500">%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setCodingCategories([...codingCategories, { name: "", description: "", weight: 0 }]);
                                                }}
                                                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                </svg>
                                                Add Category
                                            </button>
                                            
                                            <div className={`text-xs ${codingCategories.reduce((sum, c) => sum + c.weight, 0) === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                Total: {codingCategories.reduce((sum, c) => sum + c.weight, 0)}%
                                                {codingCategories.reduce((sum, c) => sum + c.weight, 0) !== 100 && ' (should equal 100%)'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* External Tools Usage */}
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-700 mb-3">
                                            External Tools Usage
                                        </h4>
                                        <div className="flex items-center gap-3">
                                            <label className="text-xs text-gray-500">
                                                AI Assist Weight:
                                            </label>
                                            <input
                                                type="number"
                                                value={scoringConfig.aiAssistWeight}
                                                onChange={(e) => setScoringConfig({
                                                    ...scoringConfig,
                                                    aiAssistWeight: Number(e.target.value)
                                                })}
                                                className="w-20 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                            />
                                            <span className="text-xs text-gray-500">%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <div className="flex justify-end gap-3 sticky bottom-0 bg-gray-50 py-4 border-t border-gray-200">
                            <Link
                                href="/company-dashboard/jobs"
                                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors bg-white"
                            >
                                Cancel
                            </Link>
                            <button
                                type="submit"
                                className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
                                disabled={createSubmitting}
                            >
                                {createSubmitting ? "Creating..." : "Create Job"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default function CreateJobPage() {
    return (
        <AuthGuard requiredRole="COMPANY">
            <CreateJobContent />
        </AuthGuard>
    );
}
