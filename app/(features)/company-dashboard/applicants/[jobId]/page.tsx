"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { useDispatch, useSelector } from "react-redux";
import { selectBreadcrumbSource } from "@/shared/state/slices/navigationSlice";
import { AuthGuard, DashboardCard } from "app/shared/components";
import SfinxSpinner from "app/shared/components/SfinxSpinner";
import Breadcrumbs from "app/shared/components/Breadcrumbs";
import { log } from "app/shared/services";
import { useBreadcrumbs } from "app/shared/hooks/useBreadcrumbs";

import { LOG_CATEGORIES } from "app/shared/services/logger.config";
const LOG_CATEGORY = LOG_CATEGORIES.COMPANY_DASHBOARD;

interface Applicant {
  id: string;
  name: string;
  image: string | null;
  email: string;
  matchScore: number | null;
  appliedAt: string;
  interviewCompleted: boolean;
  applicationId: string;
  highlights: string[];
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
  const pathname = usePathname();
  const breadcrumbSource = useSelector(selectBreadcrumbSource);
  const jobId = params.jobId;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<JobApplicantsResponse | null>(null);

  // Call breadcrumbs hook at top level (before any returns)
  const breadcrumbTrail = useBreadcrumbs({
    currentLabel: data?.job.title || "Loading...",
    currentHref: `/company-dashboard/applicants/${jobId}`,
  });

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
        log.error(LOG_CATEGORY, "Failed to fetch applicants:", err);
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
        <SfinxSpinner size="lg" title="Loading Applicants" messages="Fetching candidates..." />
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

  const completedApplicants = data.applicants.filter((a) => a.interviewCompleted);
  const pendingApplicants = data.applicants.filter((a) => !a.interviewCompleted);

  const handleViewProfile = (applicant: Applicant) => {
    // Don't dispatch here - preserve the existing breadcrumbSource from the previous navigation
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

        {/* Applicants Table */}
        <div className="space-y-6">
          {completedApplicants.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Candidate
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Score
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Highlights
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {completedApplicants.map((applicant) => (
                      <tr
                        key={applicant.id}
                        onClick={() => handleViewProfile(applicant)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {applicant.image ? (
                                <Image
                                  src={applicant.image}
                                  alt={applicant.name}
                                  width={40}
                                  height={40}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-sm font-semibold text-gray-600">
                                  {applicant.name.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{applicant.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {applicant.matchScore !== null ? (
                            <div className={`text-xl font-bold tabular-nums ${
                              applicant.matchScore >= 75
                                ? "text-emerald-600"
                                : applicant.matchScore >= 50
                                ? "text-amber-600"
                                : "text-red-600"
                            }`}>
                              {Math.round(applicant.matchScore)}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {applicant.highlights?.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {applicant.highlights.map((highlight, idx) => (
                                <span
                                  key={idx}
                                  className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full"
                                >
                                  {highlight}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <svg 
                            className="w-5 h-5 text-gray-400 inline-block"
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {pendingApplicants.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden opacity-60">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pending Interviews
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {pendingApplicants.map((applicant) => (
                      <tr key={applicant.id}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {applicant.image ? (
                                <Image
                                  src={applicant.image}
                                  alt={applicant.name}
                                  width={40}
                                  height={40}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-sm font-semibold text-gray-600">
                                  {applicant.name.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{applicant.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-full">
                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></div>
                            Pending
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

