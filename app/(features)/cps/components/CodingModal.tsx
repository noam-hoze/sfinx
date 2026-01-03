import React from "react";
import Modal from "./Modal";
import CodingSummaryOverlay from "./CodingSummaryOverlay";

interface CodingModalProps {
    isOpen: boolean;
    onClose: () => void;
    executiveSummary: string;
    recommendation: string;
    codeQuality: {
        score: number;
        text: string;
    };
    jobSpecificCategories?: Record<string, {
        score: number;
        text: string;
    }>;
}

export default function CodingModal({
    isOpen,
    onClose,
    executiveSummary,
    recommendation,
    codeQuality,
}: CodingModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Coding Summary">
            <CodingSummaryOverlay
                executiveSummary={executiveSummary}
                recommendation={recommendation}
                codeQuality={codeQuality}
            />
        </Modal>
    );
}

