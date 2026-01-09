/**
 * QuestionAnswerContext - Displays question and answer in 2-column layout
 * Used by background stage evaluations
 */

"use client";

import React from "react";

interface QuestionAnswerContextProps {
    question: string;
    answer: string;
}

export default function QuestionAnswerContext({ question, answer }: QuestionAnswerContextProps) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wider">
                    Question
                </div>
                <div className="text-sm bg-slate-100 dark:bg-slate-800 p-3 rounded max-h-40 overflow-y-auto">
                    {question}
                </div>
            </div>
            <div>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wider">
                    Answer
                </div>
                <div className="text-sm bg-slate-100 dark:bg-slate-800 p-3 rounded max-h-40 overflow-y-auto">
                    {answer}
                </div>
            </div>
        </div>
    );
}
