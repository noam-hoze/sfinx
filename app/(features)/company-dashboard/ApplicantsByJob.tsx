"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import SfinxSpinner from "app/shared/components/SfinxSpinner";
import { DashboardPageLayout, DashboardCard } from "app/shared/components";

interface JobWithApplicants {
    id: string;
    title: string;
    isActive: boolean;
    applicantCount: number;
    highestScore: number | null;
    averageScore: number | null;
    interviewedCount: number;
}

export default function ApplicantsByJob() {
    const { data: session } = useSession();
    const router = useRouter();
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
            <main className="min-h-screen bg-gray-50 flex items-center justify-center">
                <SfinxSpinner 
                    title="Loading Applicants" 
                    messages="Fetching job openings and candidates..." 
                />
            </main>
        );
    }

    return (
        <DashboardPageLayout
            title="Applicants by Job"
            subtitle="Select a job opening to view and manage its applicants"
        >
            {jobs.length === 0 ? (
                    <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-white/20 p-16 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs with applicants yet</h3>
                        <p className="text-gray-600 mb-4">Create a job posting and wait for candidates to apply</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {jobs.map((job) => (
                            <DashboardCard
                                key={job.id}
                                onClick={() => router.push(`/company-dashboard/applicants/${job.id}`)}
                                className="group relative"
                            >
                                {/* Job Title with Arrow */}
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                        {job.title}
                                    </h3>
                                    <svg 
                                        className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all"
                                        fill="none" 
                                        stroke="currentColor" 
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>

                                {/* Metrics - Side by Side */}
                                <div className="grid grid-cols-3 gap-4">
                                    {/* Applicants */}
                                    <div>
                                        <div className="text-2xl font-bold text-gray-900">{job.applicantCount}</div>
                                        <div className="text-xs text-gray-500 mt-1">Applicants</div>
                                    </div>

                                    {/* Top Score */}
                                    <div>
                                        <div className={`text-2xl font-bold ${
                                            job.highestScore !== null
                                                ? job.highestScore >= 75
                                                    ? "text-emerald-600"
                                                    : job.highestScore >= 50
                                                    ? "text-amber-600"
                                                    : "text-red-600"
                                                : "text-gray-400"
                                        }`}>
                                            {job.highestScore ?? '—'}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">Top Score</div>
                                    </div>

                                    {/* Avg Score */}
                                    <div>
                                        <div className={`text-2xl font-bold ${
                                            job.averageScore !== null
                                                ? job.averageScore >= 75
                                                    ? "text-emerald-600"
                                                    : job.averageScore >= 50
                                                    ? "text-amber-600"
                                                    : "text-red-600"
                                                : "text-gray-400"
                                        }`}>
                                            {job.averageScore ?? '—'}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">Avg Score</div>
                                    </div>
                                </div>

                                {/* Status Badge */}
                                {!job.isActive && (
                                    <span className="inline-block mt-4 text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full">
                                        Closed
                                    </span>
                                )}
                            </DashboardCard>
                        ))}
                    </div>
                )}
        </DashboardPageLayout>
    );
}

