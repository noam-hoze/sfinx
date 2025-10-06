"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type Profile = {
    displayName?: string;
    prompt?: string;
    questions?: string[];
    characteristics?: {
        scale?: number;
        independence: number;
        creativity: number;
        testingCode: number;
        documenting: number;
        speed: number;
        thoroughness: number;
        collaboration: number;
        problemSolving: number;
    };
    candidate?: {
        id: string;
        name?: string;
        tier: "expert" | "strong" | "average" | "weak";
        score: 9.0 | 7.5 | 5.0 | 2.5;
        // When mapped: array of {question, answer};
        answers?: any;
        code: string;
    };
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
    title,
    children,
}) => (
    <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 tracking-wide">
            {title}
        </h2>
        <div className="rounded-xl border border-gray-200/70 dark:border-gray-800/60 bg-white dark:bg-gray-900 shadow-sm">
            {children}
        </div>
    </section>
);

const PreBlock: React.FC<{ text?: string; lang?: string }> = ({
    text,
    lang,
}) => (
    <pre className="p-4 overflow-auto text-[12px] leading-5 whitespace-pre-wrap">
        <code>{text || ""}</code>
    </pre>
);

const CandidateConfigPage = () => {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);

    const company = searchParams.get("company");
    const role = searchParams.get("role");
    const candidateId =
        searchParams.get("candidateId") || searchParams.get("candidate");

    useEffect(() => {
        (async () => {
            try {
                if (!company || !role) {
                    setError("Missing company/role");
                    setLoading(false);
                    return;
                }
                const res = await fetch(
                    `/api/interviews/config?company=${encodeURIComponent(
                        company
                    )}&role=${encodeURIComponent(role)}${
                        candidateId
                            ? `&candidateId=${encodeURIComponent(candidateId)}`
                            : ""
                    }`
                );
                if (!res.ok) {
                    setError(`${res.status} ${await res.text()}`);
                    setLoading(false);
                    return;
                }
                const data = await res.json();
                setProfile(data.profile as Profile);
            } catch (e: any) {
                setError(String(e?.message || e));
            } finally {
                setLoading(false);
            }
        })();
    }, [company, role, candidateId]);

    const headerTitle = useMemo(() => {
        const name =
            profile?.candidate?.name || profile?.displayName || "Candidate";
        return `${name} · ${company}/${role}`;
    }, [profile, company, role]);

    const [activeTab, setActiveTab] = useState<"prompt" | "solution">("prompt");

    const qaPairs: Array<{ question: string; answer: string }> = useMemo(() => {
        const raw = (profile as any)?.candidate?.answers;
        if (!raw) return [];
        if (Array.isArray(raw)) return raw as any;
        return [];
    }, [profile]);

    const effectivePrompt = useMemo(() => {
        if (!profile) return "";
        const name =
            profile.displayName ||
            (profile as any)?.candidate?.name ||
            "Candidate";
        const qaBlock = qaPairs.length
            ? `INTERVIEW_QA (use these when the question matches):\n${qaPairs
                  .map(
                      (p, i) =>
                          `Q${i + 1}: ${p.question}\nA${i + 1}: ${p.answer}`
                  )
                  .join("\n\n")}`
            : "";
        return [profile.prompt || "", `Name: ${name}`, qaBlock]
            .filter(Boolean)
            .join("\n\n");
    }, [profile, qaPairs]);

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
            <header className="sticky top-0 z-40 border-b border-gray-200/70 dark:border-gray-800/60 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
                <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
                    <h1 className="text-base font-semibold tracking-tight">
                        {headerTitle}
                    </h1>
                    <button
                        onClick={() => router.back()}
                        className="text-xs px-3 py-1 rounded-lg border border-gray-200/70 dark:border-gray-800/60 bg-white/70 dark:bg-gray-900/70 hover:bg-white shadow-sm"
                    >
                        Back
                    </button>
                </div>
            </header>
            <main className="max-w-5xl mx-auto px-4 py-4 space-y-6">
                {loading && (
                    <div className="text-sm text-gray-500">Loading…</div>
                )}
                {error && <div className="text-sm text-red-600">{error}</div>}
                {!loading && !error && profile && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2 space-y-4">
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setActiveTab("prompt")}
                                        className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                                            activeTab === "prompt"
                                                ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800"
                                                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-800"
                                        }`}
                                        aria-current={activeTab === "prompt"}
                                    >
                                        Prompt
                                    </button>
                                    <button
                                        onClick={() => setActiveTab("solution")}
                                        className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                                            activeTab === "solution"
                                                ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800"
                                                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-800"
                                        }`}
                                        aria-current={activeTab === "solution"}
                                    >
                                        Candidate Solution
                                    </button>
                                </div>
                                {activeTab === "prompt" ? (
                                    <Section title="Prompt (effective system message)">
                                        <PreBlock text={effectivePrompt} />
                                    </Section>
                                ) : (
                                    <Section title="Candidate Solution (single-file React)">
                                        <PreBlock
                                            text={
                                                (profile as any).candidate
                                                    ?.code ||
                                                "No solution attached."
                                            }
                                        />
                                    </Section>
                                )}
                            </div>
                            <div className="space-y-4">
                                <Section title="Candidate Summary">
                                    <div className="p-4 text-sm space-y-1">
                                        <div>
                                            <span className="text-gray-500">
                                                Name:
                                            </span>{" "}
                                            {profile.displayName ||
                                                (profile as any).candidate
                                                    ?.name ||
                                                "—"}
                                        </div>
                                        {(profile as any).candidate && (
                                            <>
                                                <div>
                                                    <span className="text-gray-500">
                                                        Tier:
                                                    </span>{" "}
                                                    {
                                                        (profile as any)
                                                            .candidate.tier
                                                    }
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">
                                                        Score:
                                                    </span>{" "}
                                                    {
                                                        (profile as any)
                                                            .candidate.score
                                                    }
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </Section>
                                {qaPairs.length > 0 && (
                                    <Section title="Pre-baked Answers (aligned to questions)">
                                        <div className="p-4 text-[13px] leading-5 space-y-3">
                                            {qaPairs.map((qa, i) => (
                                                <div key={i}>
                                                    <div className="font-medium text-gray-700 dark:text-gray-300">
                                                        Q{i + 1}. {qa.question}
                                                    </div>
                                                    <div className="text-gray-800/90 dark:text-gray-300/90">
                                                        {qa.answer}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </Section>
                                )}
                                {profile.characteristics && (
                                    <Section title="Characteristics (out of 5)">
                                        <div className="p-4 text-[13px] leading-5 grid grid-cols-2 gap-x-4 gap-y-1">
                                            {Object.entries(
                                                profile.characteristics
                                            )
                                                .filter(([k]) => k !== "scale")
                                                .map(([k, v]) => (
                                                    <div
                                                        key={k}
                                                        className="flex justify-between"
                                                    >
                                                        <span className="capitalize text-gray-600">
                                                            {k
                                                                .replace(
                                                                    /([A-Z])/g,
                                                                    " $1"
                                                                )
                                                                .toLowerCase()}
                                                        </span>
                                                        <span className="font-medium">
                                                            {v as number}/
                                                            {profile
                                                                .characteristics
                                                                ?.scale || 5}
                                                        </span>
                                                    </div>
                                                ))}
                                        </div>
                                    </Section>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
};

export default CandidateConfigPage;
