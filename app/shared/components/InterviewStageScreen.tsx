"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";

type InterviewStageScreenProps = {
  children: React.ReactNode;
  onSubmit: () => void;
  ctaText: string;
  ctaDisabled?: boolean;
  bgGradient?: string;
};

export default function InterviewStageScreen({
  children,
  onSubmit,
  ctaText,
  ctaDisabled = false,
  bgGradient = "from-purple-50 to-white",
}: InterviewStageScreenProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = () => {
    setIsLoading(true);
    onSubmit();
  };

  return (
    <div className={`min-h-screen bg-gradient-to-b ${bgGradient} flex items-center justify-center p-4`}>
      <motion.div 
        className="max-w-2xl w-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: isLoading ? 0 : 1 }}
        transition={{ duration: 0.5 }}
      >
        {children}

        {/* CTA Button */}
        <style jsx>{`
          .start-button {
            background-color: rgb(124, 58, 237) !important;
            color: white !important;
          }
          .start-button:hover:not(:disabled) {
            background-color: rgb(124, 58, 237) !important;
            color: white !important;
            opacity: 1 !important;
            filter: none !important;
            transform: none !important;
          }
          .start-button:disabled,
          .start-button:disabled:hover,
          .start-button:disabled:active,
          .start-button:disabled:focus {
            background-color: rgb(156, 163, 175) !important;
            background: rgb(156, 163, 175) !important;
            color: white !important;
            opacity: 1 !important;
            filter: none !important;
            transform: none !important;
          }
        `}</style>
        <button
          onClick={handleSubmit}
          disabled={ctaDisabled || isLoading}
          className="start-button w-full px-8 py-4 text-white rounded-lg font-medium text-lg disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? "Loading..." : ctaText}
        </button>
      </motion.div>
    </div>
  );
}

