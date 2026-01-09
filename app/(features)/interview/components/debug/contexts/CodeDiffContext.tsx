/**
 * CodeDiffContext - Displays code diff and full code in 2-column layout
 * Used by coding stage evaluations
 */

"use client";

import React from "react";

interface CodeDiffContextProps {
    diff: string;
    currentCode: string;
}

export default function CodeDiffContext({ diff, currentCode }: CodeDiffContextProps) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wider">
                    Code Diff Sent
                </div>
                <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-3 rounded overflow-x-auto max-h-40">
{diff || 'No diff available'}
                </pre>
            </div>
            <div>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wider">
                    Full Current Code Sent
                </div>
                <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-3 rounded overflow-x-auto max-h-40">
{currentCode || 'No code available'}
                </pre>
            </div>
        </div>
    );
}
