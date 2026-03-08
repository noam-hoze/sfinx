"use client";

/**
 * Shared form fields for configuring background and coding contribution targets.
 */
interface ContributionTargetsFieldsProps {
    backgroundContributionsTarget: number;
    codingContributionsTarget: number;
    onBackgroundChange: (value: number) => void;
    onCodingChange: (value: number) => void;
}

/**
 * Renders the two contribution-target inputs used by company job forms.
 */
export default function ContributionTargetsFields(
    props: ContributionTargetsFieldsProps
) {
    const {
        backgroundContributionsTarget,
        codingContributionsTarget,
        onBackgroundChange,
        onCodingChange,
    } = props;

    return (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col text-sm font-medium text-gray-700">
                Background Contributions Target
                <input
                    type="number"
                    min="1"
                    value={backgroundContributionsTarget}
                    onChange={(e) => onBackgroundChange(Number(e.target.value))}
                    className="mt-1 rounded-xl border border-gray-200 px-4 py-3 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <span className="mt-1 text-xs text-gray-500">
                    Minimum accepted background contributions per experience category before confidence reaches 100%.
                </span>
            </label>
            <label className="flex flex-col text-sm font-medium text-gray-700">
                Coding Contributions Target
                <input
                    type="number"
                    min="1"
                    value={codingContributionsTarget}
                    onChange={(e) => onCodingChange(Number(e.target.value))}
                    className="mt-1 rounded-xl border border-gray-200 px-4 py-3 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <span className="mt-1 text-xs text-gray-500">
                    Minimum accepted coding contributions per coding category before confidence reaches 100%.
                </span>
            </label>
        </div>
    );
}
