"use client";
import React, { useEffect } from "react";
import InterviewIDE from "../components/InterviewIDE";
import type { RoleConfig } from "../../../shared/contexts/types";
import { InterviewProvider, useInterview } from "../../../shared/contexts";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const TrainingPage = () => {
    const { data: session, status } = useSession();
    const router = useRouter();

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
                    url.pathname + "?" + url.searchParams.toString()
                );
            }
        } catch (_) {}
    }, [router]);

    return (
        <InterviewIDE
            candidateNameOverride="Larrey (Candidate)"
            roles={roles}
        />
    );
};

export default TrainingPage;
