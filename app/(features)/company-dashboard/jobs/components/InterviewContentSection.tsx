import React from "react";
import DurationPicker from "app/shared/components/forms/DurationPicker";

export interface InterviewContentState {
    backgroundQuestion: string;
    codingPrompt: string;
    codingTemplate: string;
    codingAnswer: string;
    expectedOutput: string;
}

export interface InterviewDurationState {
    backgroundSeconds: number;
    codingSeconds: number;
}

interface InterviewContentSectionProps {
    title?: string;
    subtitle?: string;
    state: InterviewContentState;
    durations: InterviewDurationState;
    onChange: (next: InterviewContentState) => void;
    onDurationChange: (next: InterviewDurationState) => void;
    disabled?: boolean;
    onRemove?: () => void | Promise<void>;
    removeLabel?: string;
    removing?: boolean;
    canRemove?: boolean;
    /**
     * When true, the coding prompt field remains optional (used in create flows).
     */
    allowEmptyCodingPrompt?: boolean;
}

/**
 * Shared form section that captures interview content configuration, including
 * background/coding prompts and their respective timeboxes.
 */
export function InterviewContentSection({
    title = "Interview Content",
    subtitle = "Craft the background conversation and coding exercise that candidates see.",
    state,
    durations,
    onChange,
    onDurationChange,
    disabled = false,
    onRemove,
    removeLabel = "Remove content",
    removing = false,
    canRemove = true,
    allowEmptyCodingPrompt = false,
}: InterviewContentSectionProps) {
    const { backgroundQuestion, codingPrompt, codingTemplate, codingAnswer, expectedOutput } =
        state;

    const updateField =
        (key: keyof InterviewContentState) =>
        (event: React.ChangeEvent<HTMLTextAreaElement>) => {
            onChange({ ...state, [key]: event.target.value });
        };

    return (
        <section className="bg-white/80 backdrop-blur rounded-2xl border border-white/20 p-6 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-gray-800">
                        {title}
                    </h2>
                    <p className="text-sm text-gray-500">{subtitle}</p>
                </div>
                {onRemove ? (
                    <button
                        type="button"
                        className="text-sm text-red-600 hover:text-red-700 disabled:opacity-60"
                        onClick={onRemove}
                        disabled={disabled || removing || !canRemove}
                    >
                        {removing ? "Removing..." : removeLabel}
                    </button>
                ) : null}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <label className="flex flex-col text-sm font-medium text-gray-700 lg:col-span-2">
                    Background Question
                    <textarea
                        value={backgroundQuestion}
                        onChange={updateField("backgroundQuestion")}
                        disabled={disabled}
                        className="mt-1 min-h-[120px] rounded-xl border border-gray-200 px-4 py-3 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        placeholder="Tell us about your most recent project..."
                    />
                </label>

                <label className="flex flex-col text-sm font-medium text-gray-700 lg:col-span-2">
                    Coding Prompt
                    <textarea
                        value={codingPrompt}
                        onChange={updateField("codingPrompt")}
                        disabled={disabled}
                        required={!allowEmptyCodingPrompt}
                        className="mt-1 min-h-[160px] rounded-xl border border-gray-200 px-4 py-3 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        placeholder="Implement a function that merges overlapping intervals..."
                    />
                </label>

                <label className="flex flex-col text-sm font-medium text-gray-700">
                    Coding Template
                    <textarea
                        value={codingTemplate}
                        onChange={updateField("codingTemplate")}
                        disabled={disabled}
                        className="mt-1 min-h-[160px] rounded-xl border border-gray-200 px-4 py-3 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        placeholder="function solve(input) {\n    // starter code\n}"
                    />
                </label>

                <label className="flex flex-col text-sm font-medium text-gray-700">
                    Reference Answer
                    <textarea
                        value={codingAnswer}
                        onChange={updateField("codingAnswer")}
                        disabled={disabled}
                        className="mt-1 min-h-[160px] rounded-xl border border-gray-200 px-4 py-3 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        placeholder="Expected approach, edge cases, and time/space complexity..."
                    />
                </label>

                <label className="flex flex-col text-sm font-medium text-gray-700 lg:col-span-2">
                    Expected Output
                    <textarea
                        value={expectedOutput}
                        onChange={updateField("expectedOutput")}
                        disabled={disabled}
                        className="mt-1 min-h-[120px] rounded-xl border border-gray-200 px-4 py-3 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        placeholder="Describe the expected visual output or behavior (e.g., 'A list of 5 users displayed with name and email')"
                    />
                </label>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                <DurationPicker
                    label="Background Question Timebox"
                    valueSeconds={durations.backgroundSeconds}
                    onChange={(seconds) =>
                        onDurationChange({
                            backgroundSeconds: seconds,
                            codingSeconds: durations.codingSeconds,
                        })
                    }
                    disabled={disabled}
                />
                <DurationPicker
                    label="Coding Challenge Timebox"
                    valueSeconds={durations.codingSeconds}
                    onChange={(seconds) =>
                        onDurationChange({
                            backgroundSeconds: durations.backgroundSeconds,
                            codingSeconds: seconds,
                        })
                    }
                    disabled={disabled}
                />
            </div>
        </section>
    );
}

export const emptyInterviewContentState: InterviewContentState = {
    backgroundQuestion: "",
    codingPrompt: "",
    codingTemplate: "",
    codingAnswer: "",
    expectedOutput: "",
};

export const defaultInterviewDurations: InterviewDurationState = {
    backgroundSeconds: 15 * 60,
    codingSeconds: 30 * 60,
};

export default InterviewContentSection;

