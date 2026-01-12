"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import SfinxSpinner from "app/shared/components/SfinxSpinner";
import { DashboardPageLayout } from "app/shared/components";

interface JobWithApplicants {
    id: string;
    title: string;
    isActive: boolean;
    applicantCount: number;
    highestScore: number | null;
    averageScore: number | null;
    interviewedCount: number;
}

/** Renders a mini score distribution sparkline */
function ScoreDistribution({ scores }: { scores: number[] }) {
    const buckets = [0, 0, 0, 0]; // <25, 25-50, 50-75, 75+
    scores.forEach(s => {
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
                            i === 0 ? 'bg-red-400' : 
                            i === 1 ? 'bg-amber-400' : 
                            i === 2 ? 'bg-blue-400' : 
                            'bg-emerald-400'
                        }`}
                        style={{ height: `${(count / max) * 100}%` }}
                    />
                </div>
            ))}
        </div>
    );
}

/** Job card with rich metrics */
function JobCard({ job, onClick }: { job: JobWithApplicants; onClick: () => void }) {
    const hasData = job.applicantCount > 0;
    const interviewRate = job.applicantCount > 0 ? (job.interviewedCount / job.applicantCount) * 100 : 0;
    
    return (
        <button
            onClick={onClick}
            className="group relative bg-white/60 backdrop-blur-sm rounded-2xl border border-gray-200/60 p-6 hover:border-blue-300 hover:shadow-lg transition-all text-left w-full"
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors mb-1">
                        {job.title}
                    </h3>
                    <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            job.isActive 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}>
                            {job.isActive ? '● Active' : 'Closed'}
                        </span>
                        {hasData && (
                            <span className="text-xs text-gray-500">
                                {job.interviewedCount}/{job.applicantCount} interviewed
                            </span>
                        )}
                    </div>
                </div>
                <svg 
                    className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all flex-shrink-0 ml-2"
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
                        !hasData ? 'text-gray-300' :
                        (job.highestScore ?? 0) >= 75 ? 'text-emerald-600' :
                        (job.highestScore ?? 0) >= 50 ? 'text-blue-600' :
                        (job.highestScore ?? 0) >= 25 ? 'text-amber-600' :
                        'text-red-600'
                    }`}>
                        {hasData ? job.highestScore ?? '—' : '—'}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">Best</div>
                </div>
                <div className="text-center">
                    <div className={`text-3xl font-bold ${
                        !hasData ? 'text-gray-300' :
                        (job.averageScore ?? 0) >= 75 ? 'text-emerald-600' :
                        (job.averageScore ?? 0) >= 50 ? 'text-blue-600' :
                        (job.averageScore ?? 0) >= 25 ? 'text-amber-600' :
                        'text-red-600'
                    }`}>
                        {hasData ? job.averageScore ?? '—' : '—'}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">Average</div>
                </div>
            </div>

            {/* Quality Indicators */}
            {hasData && (
                <div className="space-y-2 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Interview Rate</span>
                        <span className="font-medium text-gray-900">{interviewRate.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div 
                            className={`h-1.5 rounded-full transition-all ${
                                interviewRate >= 75 ? 'bg-emerald-500' :
                                interviewRate >= 50 ? 'bg-blue-500' :
                                interviewRate >= 25 ? 'bg-amber-500' :
                                'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(interviewRate, 100)}%` }}
                        />
                    </div>
                </div>
            )}
        </button>
    );
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
                    size="lg"
                    title="Loading Applicants" 
                    messages="Fetching job openings and candidates..." 
                />
            </main>
        );
    }

    const activeJobs = jobs.filter(j => j.isActive);
    const closedJobs = jobs.filter(j => !j.isActive);
    const totalApplicants = jobs.reduce((sum, j) => sum + j.applicantCount, 0);
    const totalInterviewed = jobs.reduce((sum, j) => sum + j.interviewedCount, 0);

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
                <div className="space-y-6">
                    {/* Overview Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-4 border border-blue-200/50">
                            <div className="text-sm text-blue-700 font-medium mb-1">Active Jobs</div>
                            <div className="text-3xl font-bold text-blue-900">{activeJobs.length}</div>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl p-4 border border-emerald-200/50">
                            <div className="text-sm text-emerald-700 font-medium mb-1">Total Applicants</div>
                            <div className="text-3xl font-bold text-emerald-900">{totalApplicants}</div>
                        </div>
                        <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl p-4 border border-purple-200/50">
                            <div className="text-sm text-purple-700 font-medium mb-1">Interviewed</div>
                            <div className="text-3xl font-bold text-purple-900">{totalInterviewed}</div>
                        </div>
                        <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl p-4 border border-amber-200/50">
                            <div className="text-sm text-amber-700 font-medium mb-1">Conversion</div>
                            <div className="text-3xl font-bold text-amber-900">
                                {totalApplicants > 0 ? ((totalInterviewed / totalApplicants) * 100).toFixed(0) : 0}%
                            </div>
                        </div>
                    </div>

                    {/* Active Jobs */}
                    {activeJobs.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Active Positions</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {activeJobs.map((job) => (
                                    <JobCard
                                        key={job.id}
                                        job={job}
                                        onClick={() => router.push(`/company-dashboard/applicants/${job.id}`)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Closed Jobs */}
                    {closedJobs.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Closed Positions</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {closedJobs.map((job) => (
                                    <JobCard
                                        key={job.id}
                                        job={job}
                                        onClick={() => router.push(`/company-dashboard/applicants/${job.id}`)}
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
