"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { companiesData, Company } from "../../lib/job-search/mockData";

export default function JobSearchPage() {
    const [searchRole, setSearchRole] = useState("");
    const [searchLocation, setSearchLocation] = useState("");

    // Filter companies based on role and location
    const filteredCompanies = useMemo(() => {
        return companiesData.filter((company: Company) => {
            const roleMatch =
                !searchRole ||
                company.openRoles.some((role: any) =>
                    role.title.toLowerCase().includes(searchRole.toLowerCase())
                );

            const locationMatch =
                !searchLocation ||
                company.locations.some((loc: string) =>
                    loc.toLowerCase().includes(searchLocation.toLowerCase())
                );

            return roleMatch && locationMatch;
        });
    }, [searchRole, searchLocation]);

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto p-6">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-semibold text-gray-800 tracking-tight mb-2">
                        Find Your Dream Job
                    </h1>
                    <p className="text-gray-600">
                        Discover companies hiring for your role in your
                        preferred location
                    </p>
                </div>

                {/* Search Filters */}
                <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-white/20 p-6 mb-8 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                            {filteredCompanies.length} companies found
                        </span>
                    </div>
                </div>

                {/* Companies Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {filteredCompanies.map(
                        (company: Company, index: number) => {
                            const isMeta = company.id === "meta";
                            const CompanyCard = (
                                <div
                                    key={company.id}
                                    className={`group bg-white/60 backdrop-blur-sm rounded-2xl border border-white/20 p-6 hover:bg-white/80 hover:shadow-lg transition-all duration-300 ease-out hover:scale-105 ${
                                        isMeta
                                            ? "cursor-pointer ring-2 ring-blue-500/20 hover:ring-blue-500/40"
                                            : "cursor-pointer"
                                    }`}
                                    style={{
                                        animationDelay: `${index * 50}ms`,
                                        animation:
                                            "fadeInUp 0.5s ease-out forwards",
                                    }}
                                >
                                    {/* Company Logo */}
                                    <div className="w-24 h-24 mx-auto mb-4 bg-white rounded-xl flex items-center justify-center p-3">
                                        <img
                                            src={company.logo}
                                            alt={`${company.name} logo`}
                                            className="w-full h-full object-contain"
                                        />
                                    </div>

                                    {/* Company Info */}
                                    <div className="text-center">
                                        <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                                            {company.name}
                                        </h3>
                                        <p className="text-sm text-gray-600 mb-2">
                                            {company.industry}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {company.size} •{" "}
                                            {company.openRoles.length} open
                                            roles
                                        </p>
                                    </div>

                                    {/* Locations */}
                                    <div className="mt-3 flex flex-wrap gap-1 justify-center">
                                        {company.locations
                                            .slice(0, 2)
                                            .map(
                                                (
                                                    location: string,
                                                    idx: number
                                                ) => (
                                                    <span
                                                        key={idx}
                                                        className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded-full"
                                                    >
                                                        {location}
                                                    </span>
                                                )
                                            )}
                                        {company.locations.length > 2 && (
                                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                                +{company.locations.length - 2}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );

                            return isMeta ? (
                                <Link key={company.id} href="/interview">
                                    {CompanyCard}
                                </Link>
                            ) : (
                                CompanyCard
                            );
                        }
                    )}
                </div>

                {/* No Results */}
                {filteredCompanies.length === 0 && (
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
                            No companies found
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
