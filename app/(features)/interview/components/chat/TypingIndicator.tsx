"use client";

import React from "react";

const TypingIndicator = () => (
    <div className="flex justify-start">
        <div className="max-w-xs lg:max-w-md px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700">
            <div className="flex items-center space-x-2 mb-1">
                <span className="text-xs opacity-75 text-gray-900 dark:text-white">AI</span>
            </div>
            <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
            </div>
        </div>
    </div>
);

export default TypingIndicator;

