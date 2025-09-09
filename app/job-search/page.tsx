"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { AuthGuard } from "../../lib";

interface Job {
    id: string;
    title: string;
    type: string;
    location: string;
    salary: string | null;
}

interface Company {
    id: string;
    name: string;
    logo: string | null;
    industry: string;
    locations: string[];
    cultureTags: string[];
    size: string;
    jobs: Job[];
    hasApplied: boolean;
}

function JobSearchContent() {
    const [searchRole, setSearchRole] = useState("");
    const [searchLocation, setSearchLocation] = useState("");
    const [searchCompany, setSearchCompany] = useState("");
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [appliedJobIds, setAppliedJobIds] = useState<string[]>([]);
    const [hydrated, setHydrated] = useState(false);

    // Load saved filters on mount
    useEffect(() => {
        try {
            const savedRole = localStorage.getItem("jobSearch.role");
            const savedLocation = localStorage.getItem("jobSearch.location");
            const savedCompany = localStorage.getItem("jobSearch.company");
            if (savedRole !== null) setSearchRole(savedRole);
            if (savedLocation !== null) setSearchLocation(savedLocation);
            if (savedCompany !== null) setSearchCompany(savedCompany);
        } catch (_) {}
        setHydrated(true);
    }, []);

    // Persist filters whenever they change
    useEffect(() => {
        try {
            localStorage.setItem("jobSearch.role", searchRole);
            localStorage.setItem("jobSearch.location", searchLocation);
            localStorage.setItem("jobSearch.company", searchCompany);
        } catch (_) {}
    }, [searchRole, searchLocation, searchCompany]);

    // Fetch companies from API
    useEffect(() => {
        if (!hydrated) return;
        const fetchCompanies = async () => {
            console.log("🔄 Starting to fetch companies...");
            try {
                setLoading(true);
                const params = new URLSearchParams();
                if (searchRole) params.append("role", searchRole);
                if (searchLocation) params.append("location", searchLocation);
                if (searchCompany) params.append("company", searchCompany);

                const url = `/api/companies?${params.toString()}`;
                console.log("📡 Fetching from:", url);

                const response = await fetch(url);
                console.log("📥 Response status:", response.status);

                if (response.ok) {
                    const data = await response.json();
                    console.log("✅ Data received:", data);
                    setCompanies(data.companies);
                    setAppliedJobIds(data.appliedJobIds || []);
                    setError(null);
                } else {
                    console.error(
                        "❌ Response not ok:",
                        response.status,
                        response.statusText
                    );
                    const errorText = await response.text();
                    console.error("❌ Error response:", errorText);
                    setError(
                        `Failed to load companies: ${response.status} ${response.statusText}`
                    );
                }
            } catch (error) {
                console.error("💥 Error fetching companies:", error);
                setError(
                    "Failed to load companies. Please check your connection and try again."
                );
            } finally {
                console.log("🏁 Setting loading to false");
                setLoading(false);
            }
        };

        fetchCompanies();
    }, [hydrated, searchRole, searchLocation, searchCompany]);

    // Since we're already filtering on the server side, we can just use the companies directly
    const filteredCompanies = companies;
    const jobItems = filteredCompanies.flatMap((company: any) =>
        (company.jobs || []).map((job: any) => ({
            company,
            job,
            hasApplied: appliedJobIds.includes(job.id as string),
        }))
    );

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto p-6">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-semibold text-gray-800 tracking-tight mb-2">
                        Find My Next Job
                    </h1>
                </div>

                {/* Search Filters */}
                <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-white/20 p-6 mb-8 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Role Search */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Role / Position
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Software Engineer, Product Manager..."
                                value={searchRole}
                                onChange={(e) => setSearchRole(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all duration-300 bg-white/50 backdrop-blur-sm"
                            />
                        </div>

                        {/* Company Search */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Company / Industry
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Google, Tech, Finance..."
                                value={searchCompany}
                                onChange={(e) =>
                                    setSearchCompany(e.target.value)
                                }
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all duration-300 bg-white/50 backdrop-blur-sm"
                            />
                        </div>

                        {/* Location Search */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Location
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. San Francisco, New York, Remote..."
                                value={searchLocation}
                                onChange={(e) =>
                                    setSearchLocation(e.target.value)
                                }
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all duration-300 bg-white/50 backdrop-blur-sm"
                            />
                        </div>
                    </div>

                    {/* Results Count */}
                    <div className="mt-6 text-center">
                        <span className="text-sm text-gray-600">
                            {jobItems.length} jobs found
                        </span>
                    </div>
                </div>

                {/* Companies Grid */}
                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <p className="mt-4 text-gray-600">
                            Loading companies...
                        </p>
                    </div>
                ) : error ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                            <svg
                                className="w-8 h-8 text-red-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                                />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            Error Loading Companies
                        </h3>
                        <p className="text-gray-600 mb-4">{error}</p>
                        <button
                            onClick={() => {
                                setLoading(true);
                                setError(null);
                                // Trigger a re-fetch by updating the search state
                                setSearchRole((prev) => prev);
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {jobItems.map((item: any, index: number) => {
                            const { company, job, hasApplied } = item;
                            const isMeta = company.id === "meta";
                            const JobCard = (
                                <div
                                    key={job.id}
                                    className={`group bg-white/60 backdrop-blur-sm rounded-2xl border border-white/20 p-6 hover:bg-white/80 hover:shadow-lg transition-all duration-300 ease-out hover:scale-105 ${
                                        isMeta
                                            ? "cursor-pointer ring-2 ring-blue-500/20 hover:ring-blue-500/40"
                                            : "cursor-pointer"
                                    }`}
                                >
                                    {/* Company Logo */}
                                    <div className="relative w-24 h-24 mx-auto mb-4 bg-white rounded-xl flex items-center justify-center p-3">
                                        <Image
                                            src={company.logo || ""}
                                            alt={`${company.name} logo`}
                                            width={72}
                                            height={72}
                                            className="object-contain"
                                        />
                                        {hasApplied && (
                                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                                <svg
                                                    className="w-4 h-4 text-white"
                                                    fill="currentColor"
                                                    viewBox="0 0 20 20"
                                                >
                                                    <path
                                                        fillRule="evenodd"
                                                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                        clipRule="evenodd"
                                                    />
                                                </svg>
                                            </div>
                                        )}
                                    </div>

                                    {/* Company + Role Info */}
                                    <div className="text-center">
                                        <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                                            {company.name}
                                        </h3>
                                        <p className="text-sm text-gray-600 mb-1">
                                            {job.title}
                                        </p>
                                        <p className="text-xs text-gray-500 mb-1">
                                            {job.location} • {job.type}
                                        </p>
                                        {job.description && (
                                            <p className="text-xs text-gray-500 line-clamp-2">
                                                {job.description}
                                            </p>
                                        )}
                                    </div>

                                    {/* Tags */}
                                    <div className="mt-3 flex flex-wrap gap-1 justify-center">
                                        <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded-full">
                                            {company.industry}
                                        </span>
                                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                            {company.size}
                                        </span>
                                    </div>
                                </div>
                            );

                            return (
                                <Link
                                    key={job.id}
                                    href={`/interview?companyId=${encodeURIComponent(
                                        company.id
                                    )}&jobId=${encodeURIComponent(job.id)}`}
                                >
                                    {JobCard}
                                </Link>
                            );
                        })}
                    </div>
                )}

                {/* No Results */}
                {!loading && !error && filteredCompanies.length === 0 && (
                    <div className="text-center py-12">
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
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            No jobs found
                        </h3>
                        <p className="text-gray-600">
                            Try adjusting your search criteria
                        </p>
                    </div>
                )}
            </div>

            <style jsx>{`
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div>
    );
}

export default function JobSearchPage() {
    return (
        <AuthGuard requiredRole="CANDIDATE">
            <JobSearchContent />
        </AuthGuard>
    );
}
