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
    return (
        <InterviewIDE
            candidateNameOverride="Larrey (Candidate)"
            roles={roles}
        />
    );
};

export default TrainingPage;
