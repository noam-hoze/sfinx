// Main Library Barrel Export
export { authOptions } from "./auth";
export { log, setLevel, setAllowedFiles } from "./logger";
export { prisma } from "./prisma";
export { shouldAdvanceBackgroundStage } from "./stageGate";
export type { BackgroundGateState, BackgroundGateDecision } from "./stageGate";
export type { BackgroundPillar, BackgroundEvidence, BackgroundAssessment } from "./backgroundConfidenceScorer";
