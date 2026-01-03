"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import SfinxSpinner from "app/shared/components/SfinxSpinner";

interface JobWithApplicants {
    id: string;
    title: string;
    location: string;
    type: string;
    isActive: boolean;
    applicantCount: number;
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
        <main className="min-h-screen bg-gray-50 p-12">
            <div className="max-w-7xl mx-auto">
                {jobs.length === 0 ? (
                    <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-white/20 p-16 text-center">
                        <p className="text-gray-400">No jobs with applicants yet</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {jobs.map((job) => (
                            <button
                                key={job.id}
                                onClick={() => router.push(`/company-dashboard/applicants/${job.id}`)}
                                className="group bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-lg transition-all duration-300 ease-out hover:scale-105 flex flex-col"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <h3 className="text-base font-semibold text-gray-900 text-left flex-1">{job.title}</h3>
                                    <div className="flex flex-col items-end flex-shrink-0">
                                        <p className="text-3xl font-semibold text-gray-900">{job.applicantCount}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">applicants</p>
                                    </div>
                                </div>
                                {!job.isActive && (
                                    <span className="inline-block mt-4 text-xs px-2.5 py-1 bg-gray-50 text-gray-500 rounded-full self-start">Closed</span>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}

