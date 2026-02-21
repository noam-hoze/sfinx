/**
 * Shared TypeScript types for the Interview Guide landing page configuration.
 * Stored as JSON in Company.interviewGuideConfig.
 * All fields are required — no fallbacks permitted (AGENTS.md §I).
 */

/** Configuration for a single interview stage (timeline + tab content). */
export interface InterviewStageConfig {
    title: string;
    shortDescription: string;
    duration: string;
    format: string;
    who: string;
    description: string;
    whatToExpect: string[];
    howToPrepare: string[];
}

/** A single preparation tip card. */
export interface PrepTipConfig {
    title: string;
    description: string;
    tags: string[];
}

/** A team photo entry. */
export interface TeamPhotoConfig {
    name: string;
    imageUrl: string;
}

/**
 * Full configuration object for a company's interview guide landing page.
 * At least 1 stage required; titles are fully editable.
 */
export interface InterviewGuideConfig {
    hero: {
        tagline: string;
        imageUrl: string;
    };
    culture: {
        missionText: string;
    };
    /** URL to the company's careers / open-roles page, used for CTA buttons. */
    careersUrl?: string;
    stages: InterviewStageConfig[];
    tips: PrepTipConfig[];
    teamPhotos: TeamPhotoConfig[];
}
