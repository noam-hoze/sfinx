"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type Profile = {
    displayName?: string;
    prompt?: string;
    interviewScript?: string;
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
    <pre className="p-4 overflow-auto text-[12px] leading-5 whitespace-pre">
        <code className={lang ? `language-${lang}` : undefined}>
            {text || ""}
        </code>
    </pre>
);

function escapeHtml(s: string) {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function renderMarkdown(md?: string): string {
    if (!md) return "";
    const lines = md.replace(/\r\n?/g, "\n").split("\n");
    let html = "";
    let i = 0;
    let inCode = false;
    let codeLang = "";
    let listOpen = false;
    while (i < lines.length) {
        const raw = lines[i];
        const line = raw.trimEnd();
        // code fence
        const codeFence = line.match(/^```(.*)$/);
        if (codeFence) {
            if (!inCode) {
                inCode = true;
                codeLang = (codeFence[1] || "").trim();
                html += `<pre class=\"p-4 overflow-auto text-[12px] leading-5 whitespace-pre\"><code class=\"${
                    codeLang ? `language-${escapeHtml(codeLang)}` : ""
                }\">`;
            } else {
                html += `</code></pre>`;
                inCode = false;
                codeLang = "";
            }
            i++;
            continue;
        }
        if (inCode) {
            html += `${escapeHtml(raw)}\n`;
            i++;
            continue;
        }
        // horizontal rule
        if (/^\s*-{3,}\s*$/.test(line)) {
            if (listOpen) {
                html += `</ul>`;
                listOpen = false;
            }
            html += `<hr/>`;
            i++;
            continue;
        }
        // heading
        const h = line.match(/^(#{1,3})\s+(.*)$/);
        if (h) {
            if (listOpen) {
                html += `</ul>`;
                listOpen = false;
            }
            const lvl = h[1].length;
            const text = h[2];
            const textHtml = escapeHtml(text)
                .replace(
                    /\[([^\]]+)\]\(([^)]+)\)/g,
                    '<a href="$2" target="_blank" rel="noopener">$1</a>'
                )
                .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
                .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>")
                .replace(/`([^`]+)`/g, "<code>$1</code>");
            html += `<h${lvl} class=\"px-4 pt-4 font-semibold\">${textHtml}</h${lvl}>`;
            i++;
            continue;
        }
        // list item
        const li = line.match(/^[-*]\s+(.*)$/);
        if (li) {
            if (!listOpen) {
                html += `<ul class=\"px-6 py-2 list-disc space-y-1\">`;
                listOpen = true;
            }
            const liHtml = escapeHtml(li[1])
                .replace(
                    /\[([^\]]+)\]\(([^)]+)\)/g,
                    '<a href="$2" target="_blank" rel="noopener">$1</a>'
                )
                .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
                .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>")
                .replace(/`([^`]+)`/g, "<code>$1</code>");
            html += `<li>${liHtml}</li>`;
            i++;
            continue;
        }
        // blockquote
        const bq = line.match(/^>\s+(.*)$/);
        if (bq) {
            const bqHtml = escapeHtml(bq[1])
                .replace(
                    /\[([^\]]+)\]\(([^)]+)\)/g,
                    '<a href="$2" target="_blank" rel="noopener">$1</a>'
                )
                .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
                .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>")
                .replace(/`([^`]+)`/g, "<code>$1</code>");
            html += `<blockquote class=\"px-4 py-1 border-l-4 border-gray-300 dark:border-gray-700 ml-2 text-gray-700 dark:text-gray-300\">${bqHtml}</blockquote>`;
            i++;
            continue;
        }
        // blank line
        if (line.trim() === "") {
            if (listOpen) {
                html += `</ul>`;
                listOpen = false;
            }
            html += "";
            i++;
            continue;
        }
        // paragraph with inline code and bold
        let p = escapeHtml(line)
            .replace(
                /\[([^\]]+)\]\(([^)]+)\)/g,
                '<a href="$2" target="_blank" rel="noopener">$1</a>'
            )
            .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
            .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>")
            .replace(/`([^`]+)`/g, "<code>$1</code>");
        html += `<p class=\"px-4 py-1\">${p}</p>`;
        i++;
    }
    if (listOpen) html += `</ul>`;
    return html;
}

const MarkdownBlock: React.FC<{ text?: string }> = ({ text }) => (
    <div
        className="prose prose-sm max-w-none p-2"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
    />
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

    const [activeTab, setActiveTab] = useState<
        "prompt" | "solution" | "script"
    >("prompt");

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
                                    <button
                                        onClick={() => setActiveTab("script")}
                                        className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                                            activeTab === "script"
                                                ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800"
                                                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-800"
                                        }`}
                                        aria-current={activeTab === "script"}
                                    >
                                        Interview Script
                                    </button>
                                </div>
                                {activeTab === "prompt" && (
                                    <Section title="Prompt (effective system message)">
                                        <MarkdownBlock text={effectivePrompt} />
                                    </Section>
                                )}
                                {activeTab === "solution" && (
                                    <Section title="Candidate Solution (single-file React)">
                                        <PreBlock
                                            lang="tsx"
                                            text={
                                                (profile as any).candidate
                                                    ?.code ||
                                                "No solution attached."
                                            }
                                        />
                                    </Section>
                                )}
                                {activeTab === "script" && (
                                    <Section title="Interview Script">
                                        <MarkdownBlock
                                            text={profile.interviewScript}
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
