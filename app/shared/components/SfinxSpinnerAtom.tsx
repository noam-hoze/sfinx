"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

type SfinxSpinnerAtomProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
  title: string;
  messages: string | string[];
};

// ── Size tokens ───────────────────────────────────────────────────────────────
const SIZE_MAP = {
  sm: {
    container: 80,
    nucleusOuter: 10,
    nucleusInner: 6,
    rings: [26, 36, 46],
    electron: 3,
    blur: 4,
  },
  md: {
    container: 180,
    nucleusOuter: 22,
    nucleusInner: 14,
    rings: [58, 80, 102],
    electron: 7,
    blur: 10,
  },
  lg: {
    container: 260,
    nucleusOuter: 30,
    nucleusInner: 18,
    rings: [82, 114, 148],
    electron: 10,
    blur: 14,
  },
} as const;

// ── Orbital ring config ────────────────────────────────────────────────────────
interface RingConfig {
  rotateX: number;
  rotateZ: number;
  duration: number;
  ringColor: string;
  electronColor: string;
  glowColor: string;
  delay: number;
}

const RINGS: RingConfig[] = [
  {
    rotateX: 70,
    rotateZ: 0,
    duration: 3.2,
    ringColor: "rgba(139, 92, 246, 0.18)",
    electronColor: "#8B5CF6",
    glowColor: "rgba(139, 92, 246, 0.6)",
    delay: 0,
  },
  {
    rotateX: 70,
    rotateZ: 60,
    duration: 4.4,
    ringColor: "rgba(167, 139, 250, 0.15)",
    electronColor: "#A78BFA",
    glowColor: "rgba(167, 139, 250, 0.55)",
    delay: -1.5,
  },
  {
    rotateX: 70,
    rotateZ: 120,
    duration: 3.8,
    ringColor: "rgba(196, 181, 253, 0.12)",
    electronColor: "#C4B5FD",
    glowColor: "rgba(196, 181, 253, 0.5)",
    delay: -2.8,
  },
];

// ── ElectronOrbit ─────────────────────────────────────────────────────────────
interface ElectronOrbitProps {
  ring: RingConfig;
  radius: number;
  electronSize: number;
  containerSize: number;
}

function ElectronOrbit({ ring, radius, electronSize }: ElectronOrbitProps) {
  const diameter = radius * 2;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transformStyle: "preserve-3d",
        transform: `rotateX(${ring.rotateX}deg) rotateZ(${ring.rotateZ}deg)`,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: diameter,
          height: diameter,
          borderRadius: "50%",
          border: `1px solid ${ring.ringColor}`,
          position: "relative",
          flexShrink: 0,
        }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{
            duration: ring.duration,
            repeat: Infinity,
            ease: "linear",
            delay: ring.delay,
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
              width: electronSize,
              height: electronSize,
              borderRadius: "50%",
              backgroundColor: ring.electronColor,
              boxShadow: `0 0 ${electronSize * 1.6}px ${electronSize * 0.8}px ${ring.glowColor}`,
              marginTop: -(electronSize / 2),
              flexShrink: 0,
            }}
          />
        </motion.div>
      </div>
    </div>
  );
}

// ── Nucleus ───────────────────────────────────────────────────────────────────
interface NucleusProps {
  outerSize: number;
  innerSize: number;
}

function Nucleus({ outerSize, innerSize }: NucleusProps) {
  return (
    <motion.div
      animate={{ scale: [1, 1.18, 1], opacity: [0.35, 0.55, 0.35] }}
      transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      style={{
        position: "absolute",
        width: outerSize,
        height: outerSize,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(139,92,246,0.4) 0%, rgba(139,92,246,0) 70%)",
      }}
    >
      <motion.div
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        style={{
          position: "absolute",
          inset: 0,
          margin: "auto",
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

// ── SfinxSpinnerAtom ──────────────────────────────────────────────────────────
export default function SfinxSpinnerAtom({
  size = "md",
  className = "",
  title,
  messages,
}: SfinxSpinnerAtomProps) {
  const s = SIZE_MAP[size];
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
      className={`flex flex-col items-center ${className}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.15 }}
      style={{ marginTop: size === "lg" ? "-4rem" : "0" }}
    >
      <div
        style={{
          position: "relative",
          width: s.container,
          height: s.container,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          perspective: s.container * 2.8,
        }}
      >
        {RINGS.map((ring, i) => (
          <ElectronOrbit
            key={i}
            ring={ring}
            radius={s.rings[i]}
            electronSize={s.electron}
            containerSize={s.container}
          />
        ))}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Nucleus outerSize={s.nucleusOuter} innerSize={s.nucleusInner} />
        </div>
      </div>

      <h2
        className="font-semibold tracking-tight text-gray-900"
        style={{
          fontSize: size === "sm" ? "0.875rem" : size === "md" ? "1.25rem" : "1.75rem",
          marginTop: size === "sm" ? "0.5rem" : "1rem",
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
