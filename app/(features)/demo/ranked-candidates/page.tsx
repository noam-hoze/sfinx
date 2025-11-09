/**
 * Demo ranked candidates page - Stage 5 of the demo flow.
 * Displays hiring manager view with ranked candidate list and status pie chart.
 */

"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useEffect, useState } from "react";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";
import DemoProgressHeader from "../components/DemoProgressHeader";
import { generateMockCandidates } from "../utils/generateMockCandidates";

function RankedCandidatesContent() {
    const searchParams = useSearchParams();
    const candidateId = searchParams.get("candidateId");
    const applicationId = searchParams.get("applicationId");
    const [realCandidateData, setRealCandidateData] = useState<{
        name: string;
        score: number;
    } | null>(null);

    useEffect(() => {
        if (candidateId) {
            fetch(`/api/candidates/${candidateId}/basic?skip-auth=true`)
                .then((res) => res.json())
                .then((data) => {
                    if (data.name && typeof data.score === "number") {
                        setRealCandidateData({ name: data.name, score: data.score });
                    }
                })
                .catch((err) => console.error("Failed to fetch candidate data:", err));
        }
    }, [candidateId]);

    const candidates = useMemo(() => {
        const mocks = generateMockCandidates(
            99,
            candidateId || "real",
            applicationId || "mock-app"
        );
        const realCandidate = {
            id: candidateId || "real",
            name: realCandidateData?.name || "You",
            score: realCandidateData?.score || 0,
            status: "Completed" as const,
            summary: "Your interview",
            cpsLink: `/cps?demo=true&candidateId=${candidateId}&applicationId=${applicationId}`,
        };
        const allCandidates = [...mocks, realCandidate];
        return allCandidates.sort((a, b) => b.score - a.score);
    }, [candidateId, applicationId, realCandidateData]);

    const statusData = useMemo(() => {
        const completed = candidates.filter((c) => c.status === "Completed").length;
        const invited = candidates.filter((c) => c.status === "Invited").length;
        return [
            { name: "Completed", value: completed },
            { name: "Invited", value: invited },
        ];
    }, [candidates]);

    const COLORS = ["#3b82f6", "#94a3b8"];

    return (
        <div className="min-h-screen bg-gray-50">
            <DemoProgressHeader currentStage={5} />

            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                    <h1 className="text-3xl font-semibold text-gray-900 mb-8">
                        Candidate Rankings - Frontend Engineer at Meta
                    </h1>

                    <div className="mb-8">
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, value }) => `${name}: ${value}`}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {statusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Rank
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Name
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Score
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {candidates.map((candidate, index) => {
                                    return (
                                        <tr
                                            key={candidate.id}
                                            className={
                                                candidate.id === candidateId
                                                    ? "bg-blue-50"
                                                    : ""
                                            }
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {index + 1}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {candidate.name}
                                                    {candidate.id === candidateId && (
                                                        <span className="ml-2 text-xs font-semibold text-blue-600">
                                                            (You)
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-semibold text-blue-600">
                                                    {candidate.score}%
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span
                                                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                        candidate.status === "Completed"
                                                            ? "bg-green-100 text-green-800"
                                                            : "bg-yellow-100 text-yellow-800"
                                                    }`}
                                                >
                                                    {candidate.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {candidate.status === "Completed" ? (
                                                    <a
                                                        href={candidate.cpsLink}
                                                        className="text-blue-600 hover:text-blue-800 font-medium"
                                                    >
                                                        View Report
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-400">Pending</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function RankedCandidatesPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <RankedCandidatesContent />
        </Suspense>
    );
}

