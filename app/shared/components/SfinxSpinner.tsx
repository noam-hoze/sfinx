"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

type SfinxSpinnerProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
  title: string;
  messages: string | string[];
};

const SIZES = {
  sm: { atom: 24,  nucleus: 4,  nucleusInner: 2,  orbit: 14,  electron: 2  },
  md: { atom: 300, nucleus: 25, nucleusInner: 15, orbit: 170, electron: 10 },
  lg: { atom: 450, nucleus: 35, nucleusInner: 21, orbit: 255, electron: 14 },
};

const ORBITS = [
  { transform: "rotateY(65deg) rotateX(5deg)",   trailAnim: "sfinx-orbit-trail-1", trailDuration: "2s",   color: "#c084fc", electronDuration: 1.5, electronDelay: -1 },
  { transform: "rotateY(65deg) rotateX(-54deg)", trailAnim: "sfinx-orbit-trail-2", trailDuration: "2.5s", color: "#818cf8", electronDuration: 2,   electronDelay: 0  },
  { transform: "rotateY(65deg) rotateX(54deg)",  trailAnim: "sfinx-orbit-trail-3", trailDuration: "2s",   color: "#22d3ee", electronDuration: 1.5, electronDelay: 0  },
];

// ── Nucleus ───────────────────────────────────────────────────────────────────
function Nucleus({ outerSize, innerSize }: { outerSize: number; innerSize: number }) {
  return (
    <motion.div
      animate={{ scale: [1, 1.18, 1], opacity: [0.35, 0.55, 0.35] }}
      transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      style={{
        position: "relative",
        width: outerSize,
        height: outerSize,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(139,92,246,0.4) 0%, rgba(139,92,246,0) 70%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <motion.div
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        style={{
          width: innerSize,
          height: innerSize,
          borderRadius: "50%",
          background: "radial-gradient(circle at 38% 35%, #C4B5FD 0%, #8B5CF6 55%, #6D28D9 100%)",
          boxShadow: "0 0 12px 4px rgba(139,92,246,0.45), 0 0 2px 1px rgba(196,181,253,0.6)",
        }}
      />
    </motion.div>
  );
}

// ── SfinxSpinner ──────────────────────────────────────────────────────────────
export default function SfinxSpinner({ size = "md", className = "", title, messages }: SfinxSpinnerProps) {
  const s = SIZES[size];
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
    <div className="text-center" style={{ marginTop: "-8rem" }}>
      {/* Atom container */}
      <div
        className={className}
        style={{
          position: "relative",
          width: s.atom,
          height: s.atom,
          display: "inline-block",
          margin: "10px auto",
          animation: "sfinxFadeIn 0.5s ease-in 0.2s both",
        }}
      >
        {/* Nucleus — centered absolutely */}
        <div
          style={{
            position: "absolute",
            top: 0, right: 0, bottom: 0, left: 0,
            margin: "auto",
            width: s.nucleus,
            height: s.nucleus,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <Nucleus outerSize={s.nucleus} innerSize={s.nucleusInner} />
        </div>

        {/* Three orbital rings */}
        {ORBITS.map((orbit, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: 0, right: 0, bottom: 0, left: 0,
              margin: "auto",
              width: s.orbit,
              height: s.orbit,
              borderRadius: "50%",
              border: "0.5px solid rgba(124, 58, 237, 0.1)",
              transformStyle: "preserve-3d",
              transform: orbit.transform,
              animation: `${orbit.trailAnim} ${orbit.trailDuration} infinite ease-in-out`,
            }}
          >
            {/* Electron — Framer Motion rotation around ring center */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{
                duration: orbit.electronDuration,
                repeat: Infinity,
                ease: "linear",
                delay: orbit.electronDelay,
              }}
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: s.electron,
                  height: s.electron,
                  borderRadius: "50%",
                  backgroundColor: orbit.color,
                  boxShadow: `0 0 15px ${orbit.color}`,
                  marginTop: -(s.electron / 2),
                  flexShrink: 0,
                }}
              />
            </motion.div>
          </div>
        ))}
      </div>

      <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-4">
        {title}
      </h2>
      <p className="text-base md:text-lg text-gray-600">
        <span key={currentMessageIndex} style={{ animation: "sfinxFadeIn 0.5s ease-in forwards" }}>
          {messageArray[currentMessageIndex]}
        </span>
      </p>
    </div>
  );
}
