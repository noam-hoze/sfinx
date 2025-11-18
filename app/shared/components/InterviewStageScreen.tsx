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
        <button
          onClick={handleSubmit}
          disabled={ctaDisabled || isLoading}
          className="w-full px-8 py-4 bg-sfinx-purple text-white rounded-lg font-medium text-lg hover:opacity-90 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed disabled:hover:opacity-100"
        >
          {isLoading ? "Loading..." : ctaText}
        </button>
      </motion.div>
    </div>
  );
}

