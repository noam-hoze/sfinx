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

    // Wrap to inject candidate name override via context queue
    const roles: RoleConfig = { interviewer: "human", candidate: "elevenLabs" };
    return (
        <InterviewIDE
            candidateNameOverride="Larrey (Candidate)"
            roles={roles}
        />
    );
};

export default TrainingPage;
