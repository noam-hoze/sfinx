import React, { useState } from "react";
import DurationPicker from "app/shared/components/forms/DurationPicker";

export interface InterviewContentState {
    backgroundQuestion: string;
    codingPrompt: string;
    codingTemplate: string;
    codingAnswer: string;
    expectedOutput: string;
    codingLanguage: string;
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
    activeTab?: TabType;
    onTabChange?: (tab: TabType) => void;
}

type TabType = 'experience' | 'coding';

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
    activeTab: externalActiveTab,
    onTabChange,
}: InterviewContentSectionProps) {
    const { backgroundQuestion, codingPrompt, codingTemplate, codingAnswer, expectedOutput } =
        state;
    const [internalActiveTab, setInternalActiveTab] = useState<TabType>('experience');
    
    const activeTab = externalActiveTab !== undefined ? externalActiveTab : internalActiveTab;
    const setActiveTab = onTabChange || setInternalActiveTab;

    const updateField =
        (key: keyof InterviewContentState) =>
        (event: React.ChangeEvent<HTMLTextAreaElement>) => {
            onChange({ ...state, [key]: event.target.value });
        };

    return (
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-6">
                <h2 className="text-xl font-semibold text-gray-800">
                    {title}
                </h2>
                <p className="text-sm text-gray-500">{subtitle}</p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
                {[
                    { id: 'experience' as TabType, label: 'Experience' },
                    { id: 'coding' as TabType, label: 'Coding' },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 py-3 text-sm font-medium transition-all border-b-2 text-center ${
                            activeTab === tab.id
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'experience' && (
                <div className="space-y-0">
                    <div className="px-6 py-4 bg-white">
                        <DurationPicker
                            label="Time Limit"
                            valueSeconds={durations.backgroundSeconds}
                            onChange={(seconds) =>
                                onDurationChange({
                                    backgroundSeconds: seconds,
                                    codingSeconds: durations.codingSeconds,
                                })
                            }
                            disabled={disabled}
                        />
                    </div>
                    <div className="px-6 py-4 bg-gray-100">
                        <label id="background-question" className="flex flex-col text-sm font-medium text-gray-700 scroll-mt-24">
                            Starter Question
                            <textarea
                                value={backgroundQuestion}
                                onChange={updateField("backgroundQuestion")}
                                disabled={disabled}
                                className="mt-2 w-full min-h-[120px] rounded-xl border border-gray-200 px-4 py-3 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 bg-white"
                                placeholder="Tell us about your most recent project..."
                            />
                        </label>
                    </div>
                </div>
            )}

            {activeTab === 'coding' && (
                <div className="space-y-0">
                    <div className="px-6 py-4 bg-white space-y-4">
                        <DurationPicker
                            label="Time Limit"
                            valueSeconds={durations.codingSeconds}
                            onChange={(seconds) =>
                                onDurationChange({
                                    backgroundSeconds: durations.backgroundSeconds,
                                    codingSeconds: seconds,
                                })
                            }
                            disabled={disabled}
                        />
                        <label className="flex flex-col text-sm font-medium text-gray-700">
                            Programming Language
                            <select
                                value={state.codingLanguage}
                                onChange={(e) => onChange({ ...state, codingLanguage: e.target.value })}
                                disabled={disabled}
                                required
                                className="mt-2 rounded-xl border border-gray-200 px-4 py-3 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <option value="">Select language...</option>
                                <option value="python">Python</option>
                                <option value="javascript">JavaScript</option>
                                <option value="typescript">TypeScript</option>
                                <option value="java">Java</option>
                                <option value="cpp">C++</option>
                                <option value="csharp">C#</option>
                                <option value="go">Go</option>
                                <option value="rust">Rust</option>
                            </select>
                        </label>
                    </div>
                    <div className="px-6 py-4 bg-gray-100">
                        <label id="coding-prompt" className="flex flex-col text-sm font-medium text-gray-700 scroll-mt-24">
                            Coding Prompt
                            <textarea
                                value={codingPrompt}
                                onChange={updateField("codingPrompt")}
                                disabled={disabled}
                                required={!allowEmptyCodingPrompt}
                                className="mt-2 min-h-[160px] rounded-xl border border-gray-200 px-4 py-3 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 bg-white"
                                placeholder="Implement a function that merges overlapping intervals..."
                            />
                        </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-6 py-4 bg-white">
                        <label id="coding-template" className="flex flex-col text-sm font-medium text-gray-700 scroll-mt-24">
                            Coding Template
                            <textarea
                                value={codingTemplate}
                                onChange={updateField("codingTemplate")}
                                disabled={disabled}
                                className="mt-2 min-h-[160px] rounded-xl border border-gray-200 px-4 py-3 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                                placeholder="function solve(input) {\n    // starter code\n}"
                            />
                        </label>

                        <label id="coding-answer" className="flex flex-col text-sm font-medium text-gray-700 scroll-mt-24">
                            Reference Answer
                            <textarea
                                value={codingAnswer}
                                onChange={updateField("codingAnswer")}
                                disabled={disabled}
                                className="mt-2 min-h-[160px] rounded-xl border border-gray-200 px-4 py-3 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                                placeholder="Expected approach, edge cases, and time/space complexity..."
                            />
                        </label>
                    </div>

                    <div className="px-6 py-4 bg-gray-100">
                        <label id="expected-output" className="flex flex-col text-sm font-medium text-gray-700 scroll-mt-24">
                            Expected Output
                            <textarea
                                value={expectedOutput}
                                onChange={updateField("expectedOutput")}
                                disabled={disabled}
                                className="mt-2 min-h-[120px] rounded-xl border border-gray-200 px-4 py-3 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 bg-white"
                                placeholder="Describe the expected visual output or behavior (e.g., 'A list of 5 users displayed with name and email')"
                            />
                        </label>
                    </div>
                </div>
            )}
        </section>
    );
}

export const emptyInterviewContentState: InterviewContentState = {
    backgroundQuestion: "",
    codingPrompt: "",
    codingTemplate: "",
    codingAnswer: "",
    expectedOutput: "",
    codingLanguage: "",
};

export const defaultInterviewDurations: InterviewDurationState = {
    backgroundSeconds: 15 * 60,
    codingSeconds: 30 * 60,
};

export default InterviewContentSection;

