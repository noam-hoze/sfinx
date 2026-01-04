"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { AuthGuard, DashboardCard } from "app/shared/components";
import SfinxSpinner from "app/shared/components/SfinxSpinner";
import Breadcrumbs from "app/shared/components/Breadcrumbs";
import { log } from "app/shared/services";
import { getBreadcrumbTrail } from "app/shared/config/navigation";

interface Applicant {
  id: string;
  name: string;
  image: string | null;
  email: string;
  matchScore: number | null;
  appliedAt: string;
  interviewCompleted: boolean;
  applicationId: string;
}

interface JobApplicantsResponse {
  job: {
    id: string;
    title: string;
    location: string;
    type: string;
  };
  applicants: Applicant[];
}

function JobApplicantsContent() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const jobId = params.jobId;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<JobApplicantsResponse | null>(null);

  useEffect(() => {
    const fetchApplicants = async () => {
      try {
        const res = await fetch(`/api/company/jobs/${jobId}/applicants`);
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(errorData.error || `Failed to load applicants (${res.status})`);
        }
        const result = await res.json();
        setData(result);
        setError(null);
      } catch (err) {
        log.error("Failed to fetch applicants:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchApplicants();
  }, [jobId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <SfinxSpinner title="Loading Applicants" messages="Fetching candidates..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 p-12">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700">{error || "Failed to load applicants"}</p>
          </div>
        </div>
      </div>
    );
  }

  const breadcrumbTrail = [
    { label: "Applicants", href: "/company-dashboard" },
    { label: data.job.title, href: `/company-dashboard/applicants/${jobId}` },
  ];

  const completedApplicants = data.applicants.filter((a) => a.interviewCompleted);
  const pendingApplicants = data.applicants.filter((a) => !a.interviewCompleted);

  const handleViewProfile = (applicant: Applicant) => {
    router.push(
      `/cps?candidateId=${applicant.id}&applicationId=${applicant.applicationId}`
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Breadcrumbs */}
        <div className="mb-6">
          <Breadcrumbs items={breadcrumbTrail} />
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">
            {data.job.title}
          </h1>
          <p className="text-gray-600">
            {data.applicants.length} total applicant{data.applicants.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Applicants List */}
        <div className="space-y-6">
          {/* Completed Interviews */}
          {completedApplicants.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {completedApplicants.map((applicant) => (
                  <DashboardCard
                    key={applicant.id}
                    onClick={() => handleViewProfile(applicant)}
                    className="group relative"
                  >
                    {/* Avatar */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {applicant.image ? (
                          <Image
                            src={applicant.image}
                            alt={applicant.name}
                            width={48}
                            height={48}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-lg font-semibold text-gray-600">
                            {applicant.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <svg 
                        className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all ml-auto"
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>

                    {/* Info */}
                    <div className="mb-4">
                      <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors mb-1">
                        {applicant.name}
                      </h3>
                      <p className="text-xs text-gray-600 truncate">{applicant.email}</p>
                    </div>

                    {/* Score */}
                    {applicant.matchScore !== null && (
                      <div className="pt-3 border-t border-gray-100">
                        <div className="text-2xl font-bold text-green-600 tabular-nums">
                          {Math.round(applicant.matchScore)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">Score</div>
                      </div>
                    )}
                  </DashboardCard>
                ))}
            </div>
          )}

          {/* Pending Interviews */}
          {pendingApplicants.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {pendingApplicants.map((applicant) => (
                  <DashboardCard
                    key={applicant.id}
                    className="opacity-60 cursor-default"
                  >
                    {/* Avatar */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {applicant.image ? (
                          <Image
                            src={applicant.image}
                            alt={applicant.name}
                            width={48}
                            height={48}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-lg font-semibold text-gray-600">
                            {applicant.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="mb-4">
                      <h3 className="text-base font-semibold text-gray-900 mb-1">
                        {applicant.name}
                      </h3>
                      <p className="text-xs text-gray-600 truncate">{applicant.email}</p>
                    </div>

                    {/* Status */}
                    <div className="pt-3 border-t border-gray-100">
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-full">
                        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></div>
                        Pending
                      </span>
                    </div>
                  </DashboardCard>
                ))}
            </div>
          )}

          {/* Empty State */}
          {data.applicants.length === 0 && (
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-white/20 p-16 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No applicants yet</h3>
              <p className="text-gray-600">
                Candidates who apply to this position will appear here
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function JobApplicantsPage() {
  return (
    <AuthGuard requiredRole="COMPANY">
      <JobApplicantsContent />
    </AuthGuard>
  );
}

