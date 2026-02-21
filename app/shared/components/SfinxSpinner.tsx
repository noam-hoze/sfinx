"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const AtomScene = dynamic(() => import("./AtomScene"), { ssr: false });

type SfinxSpinnerProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
  title: string;
  messages: string | string[];
};

export default function SfinxSpinner({ size = "md", className = "", title, messages }: SfinxSpinnerProps) {
  const messageArray = Array.isArray(messages) ? messages : [messages];
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  useEffect(() => {
    if (messageArray.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % messageArray.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [messageArray.length]);

  return (
    <motion.div
      className={`text-center ${className}`}
      style={{ marginTop: size === "lg" ? "-4rem" : "-2rem" }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.15 }}
    >
      <AtomScene size={size} />

      <h2
        className="font-semibold tracking-tight text-gray-900"
        style={{
          fontSize: size === "sm" ? "0.875rem" : size === "md" ? "1.5rem" : "2rem",
          marginTop: size === "sm" ? "0.5rem" : "0.75rem",
          marginBottom: size === "sm" ? "0.25rem" : "0.5rem",
        }}
      >
        {title}
      </h2>

      <div
        style={{
          height: size === "sm" ? "1.1rem" : "1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <AnimatePresence mode="wait">
          <motion.p
            key={currentMessageIndex}
            className="text-gray-500"
            style={{
              fontSize: size === "sm" ? "0.75rem" : size === "md" ? "0.9375rem" : "1.0625rem",
            }}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
          >
            {messageArray[currentMessageIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
