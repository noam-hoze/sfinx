/**
 * Score Progress Display Component
 * Shows real-time experience, coding, and final scores during interview
 */

interface ScoreProgressDisplayProps {
    experienceScore: number;
    codingScore: number;
    finalScore: number;
    experienceWeight: number;
    codingWeight: number;
}

export default function ScoreProgressDisplay({
    experienceScore,
    codingScore,
    finalScore,
    experienceWeight,
    codingWeight
}: ScoreProgressDisplayProps) {
    return (
        <div className="grid grid-cols-3 gap-4 mb-6">
            {/* Experience Score */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                <div className="text-xs uppercase tracking-wider text-purple-600 dark:text-purple-400 font-semibold mb-1">
                    Experience ({experienceWeight}%)
                </div>
                <div className="text-3xl font-bold text-purple-900 dark:text-purple-300">
                    {experienceScore}
                    <span className="text-lg text-purple-600 dark:text-purple-400">/100</span>
                </div>
            </div>

            {/* Coding Score */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                <div className="text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 font-semibold mb-1">
                    Coding ({codingWeight}%)
                </div>
                <div className="text-3xl font-bold text-blue-900 dark:text-blue-300">
                    {codingScore}
                    <span className="text-lg text-blue-600 dark:text-blue-400">/100</span>
                </div>
            </div>

            {/* Final Score */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border-2 border-green-300 dark:border-green-700">
                <div className="text-xs uppercase tracking-wider text-green-700 dark:text-green-400 font-semibold mb-1">
                    Final Score
                </div>
                <div className="text-3xl font-bold text-green-900 dark:text-green-300">
                    {finalScore}
                    <span className="text-lg text-green-600 dark:text-green-400">/100</span>
                </div>
            </div>
        </div>
    );
}
