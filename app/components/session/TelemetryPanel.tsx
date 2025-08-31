import React from "react";

const TelemetryPanel = () => {
    return (
        <div className="bg-white rounded-lg shadow-lg p-6 w-full lg:w-1/3">
            <h2 className="text-2xl font-bold mb-4 text-[#1C1C1E]">
                Live Telemetry
            </h2>
            <div className="space-y-4">
                {[
                    "Iteration Speed",
                    "Debug Loops",
                    "AI Assist Usage",
                    "Learning Velocity",
                ].map((metric) => (
                    <div key={metric} className="p-4 bg-[#FAFAFA] rounded-md">
                        <h3 className="font-semibold text-slate-700">
                            {metric}
                        </h3>
                        <div className="h-24 bg-gray-200 rounded-md mt-2 flex items-center justify-center">
                            <p className="text-sm text-gray-500">
                                Chart Placeholder
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TelemetryPanel;
