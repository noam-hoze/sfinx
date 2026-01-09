import React from "react";
import Modal from "./Modal";
import SummaryOverlay from "./SummaryOverlay";

interface ExperienceModalProps {
    isOpen: boolean;
    onClose: () => void;
    executiveSummary: string;
    recommendation: string;
    experienceCategories: Record<string, {
        score: number;
        text: string;
    }>;
    jobExperienceCategories: Array<{
        name: string;
        description: string;
        weight: number;
    }>;
}

export default function ExperienceModal({
    isOpen,
    onClose,
    executiveSummary,
    recommendation,
    experienceCategories,
    jobExperienceCategories,
}: ExperienceModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Experience Summary">
            <SummaryOverlay
                executiveSummary={executiveSummary}
                recommendation={recommendation}
                experienceCategories={experienceCategories}
                jobExperienceCategories={jobExperienceCategories}
            />
        </Modal>
    );
}

