import React from "react";
import Modal from "./Modal";
import SummaryOverlay from "./SummaryOverlay";

interface ExperienceModalProps {
    isOpen: boolean;
    onClose: () => void;
    executiveSummary: string;
    recommendation: string;
    adaptability: {
        score: number;
        text: string;
        evidence: any[];
    };
    creativity: {
        score: number;
        text: string;
        evidence: any[];
    };
    reasoning: {
        score: number;
        text: string;
        evidence: any[];
    };
}

export default function ExperienceModal({
    isOpen,
    onClose,
    executiveSummary,
    recommendation,
    adaptability,
    creativity,
    reasoning,
}: ExperienceModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Experience Summary">
            <SummaryOverlay
                executiveSummary={executiveSummary}
                recommendation={recommendation}
                adaptability={adaptability}
                creativity={creativity}
                reasoning={reasoning}
            />
        </Modal>
    );
}

