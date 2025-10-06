"use client";
import React, { useEffect, useMemo } from "react";
import InterviewIDE from "../components/InterviewIDE";
import type { RoleConfig } from "../../../shared/contexts/types";
import { InterviewProvider, useInterview } from "../../../shared/contexts";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { createCandidates } from "server/data/interviews/meta/frontend-developer/createCandidates";

const TrainingPage = () => {
    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (status === "loading") return;
        const role = (session?.user as any)?.role;
        if (role !== "COMPANY") {
            router.replace("/job-search");
        }
    }, [session, status, router]);

    // Select candidate engine via env (NEXT_PUBLIC_CANDIDATE_ENGINE)
    const engine =
        process.env.NEXT_PUBLIC_CANDIDATE_ENGINE === "openai"
            ? "openai"
            : "elevenLabs";
    const roles: RoleConfig = {
        interviewer: "human",
        candidate: engine as any,
    };

    // Ensure required interview params are present in URL (no fallback semantics)
    useEffect(() => {
        try {
            const url = new URL(window.location.href);
            const hasCompany = url.searchParams.has("company");
            const hasRole = url.searchParams.has("role");
            if (!hasCompany || !hasRole) {
                url.searchParams.set("company", "meta");
                url.searchParams.set("role", "frontend-developer");
                router.replace(
                    (url.pathname + "?" + url.searchParams.toString()) as any
                );
            }
        } catch (_) {}
    }, [router]);

    // Candidate dropdown data
    const candidates = useMemo(() => createCandidates(""), []);
    useEffect(() => {
        try {
            const url = new URL(window.location.href);
            const hasCandidate = url.searchParams.has("candidateId");
            if (!hasCandidate && candidates.length > 0) {
                url.searchParams.set("candidateId", candidates[0].id);
                router.replace(
                    (url.pathname + "?" + url.searchParams.toString()) as any
                );
            }
        } catch (_) {}
    }, [router, candidates]);

    const selectedCandidateId =
        searchParams.get("candidateId") || candidates[0]?.id || "";

    return (
        <div className="space-y-3">
            <div className="sticky top-14 z-30 border-b border-gray-200/70 dark:border-gray-800/60 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl">
                <div className="max-w-8xl mx-auto px-3 py-2">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-600">
                                Candidate
                            </label>
                            <select
                                className="border rounded px-2 py-1 text-sm bg-white/80 backdrop-blur-md hover:bg-white transition"
                                value={selectedCandidateId}
                                onChange={(e) => {
                                    const id = e.target.value;
                                    try {
                                        const url = new URL(
                                            window.location.href
                                        );
                                        url.searchParams.set("candidateId", id);
                                        router.replace(
                                            (url.pathname +
                                                "?" +
                                                url.searchParams.toString()) as any
                                        );
                                    } catch (_) {}
                                }}
                            >
                                {candidates.map((c) => (
                                    <option key={c.id} value={c.id}>{`${
                                        c.name
                                    } · ${c.tier} · ${c.score.toFixed(
                                        1
                                    )}`}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                try {
                                    const url = new URL(window.location.href);
                                    const isOn =
                                        url.searchParams.get("rec") === "on";
                                    url.searchParams.set(
                                        "rec",
                                        isOn ? "off" : "on"
                                    );
                                    router.replace(
                                        (url.pathname +
                                            "?" +
                                            url.searchParams.toString()) as any
                                    );
                                } catch (_) {}
                            }}
                            className="group inline-flex items-center gap-2 pl-2 pr-3 py-1 rounded-full border border-gray-200/70 bg-white/80 backdrop-blur-md shadow-sm hover:shadow transition-all"
                            aria-label="Toggle recording"
                        >
                            <span
                                className={`inline-block h-2.5 w-2.5 rounded-full ${
                                    searchParams.get("rec") === "on"
                                        ? "bg-red-500 shadow-[0_0_0_2px_rgba(255,59,48,0.25)]"
                                        : "bg-gray-300"
                                }`}
                            ></span>
                            <span className="text-xs font-medium text-gray-700 tracking-wide">
                                {searchParams.get("rec") === "on"
                                    ? "REC On"
                                    : "REC Off"}
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                try {
                                    const url = new URL(window.location.href);
                                    const company =
                                        url.searchParams.get("company");
                                    const role = url.searchParams.get("role");
                                    const candidate =
                                        url.searchParams.get("candidateId");
                                    const dest = new URL(
                                        `/interview/config?company=${encodeURIComponent(
                                            company || ""
                                        )}&role=${encodeURIComponent(
                                            role || ""
                                        )}${
                                            candidate
                                                ? `&candidateId=${encodeURIComponent(
                                                      candidate
                                                  )}`
                                                : ""
                                        }`,
                                        window.location.origin
                                    );
                                    window.open(
                                        dest.toString(),
                                        "_blank",
                                        "noopener,noreferrer"
                                    );
                                } catch (_) {}
                            }}
                            className="inline-flex items-center gap-2 px-3 py-1 rounded-lg border border-gray-200/70 bg-white/80 hover:bg-white shadow-sm transition-all text-xs font-medium text-gray-700"
                        >
                            View Config
                        </button>
                    </div>
                </div>
            </div>
            <div className="px-3">
                <InterviewIDE
                    candidateNameOverride={`${(() => {
                        const id = selectedCandidateId;
                        const found = candidates.find((c) => c.id === id);
                        return (found?.name || "Candidate").toString();
                    })()}`}
                    roles={roles}
                />
            </div>
        </div>
    );
};

export default TrainingPage;
