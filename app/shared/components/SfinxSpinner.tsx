"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

type SfinxSpinnerProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
  title: string;
  messages: string | string[];
};

// ── Size tokens ───────────────────────────────────────────────────────────────
// All measurements in px. The atom container is a square; nucleus is the
// glowing core; each ring has its own radius; electrons are small dots.
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
// Each ring has a 3-D tilt expressed as rotateX + rotateZ (applied via inline
// style on a wrapper), a rotation speed, and a color in the Sfinx purple ramp.
interface RingConfig {
  rotateX: number;
  rotateZ: number;
  duration: number;           // seconds for one full electron orbit
  ringColor: string;          // subtle ring stroke
  electronColor: string;      // vivid electron dot
  glowColor: string;          // rgba string for box-shadow glow
  delay: number;              // animation start offset
}

const RINGS: RingConfig[] = [
  {
    // Tilted ~30° from front, nearly vertical plane
    rotateX: 70,
    rotateZ: 0,
    duration: 3.2,
    ringColor: "rgba(139, 92, 246, 0.18)",     // violet-500 very dim
    electronColor: "#8B5CF6",                   // violet-500
    glowColor: "rgba(139, 92, 246, 0.6)",
    delay: 0,
  },
  {
    // Cross-plane — rotated 60° around Z relative to ring 1
    rotateX: 70,
    rotateZ: 60,
    duration: 4.4,
    ringColor: "rgba(167, 139, 250, 0.15)",     // violet-400 dim
    electronColor: "#A78BFA",                   // violet-400
    glowColor: "rgba(167, 139, 250, 0.55)",
    delay: -1.5,
  },
  {
    // Third plane — 120° around Z
    rotateX: 70,
    rotateZ: 120,
    duration: 3.8,
    ringColor: "rgba(196, 181, 253, 0.12)",     // violet-300 dim
    electronColor: "#C4B5FD",                   // violet-300
    glowColor: "rgba(196, 181, 253, 0.5)",
    delay: -2.8,
  },
];

// ── ElectronOrbit ─────────────────────────────────────────────────────────────
// A single orbital ring + its electron dot.
// The trick: we rotate the *entire ring container* (which is the full atom
// width/height but has `transform-style: preserve-3d` + a CSS tilt).
// Inside that tilted plane, a small dot is placed at the edge and we spin it
// around the center using Framer Motion's `rotate` animation, so the 3-D tilt
// of the container gives the elliptical illusion.
interface ElectronOrbitProps {
  ring: RingConfig;
  radius: number;          // half the ring diameter
  electronSize: number;
  containerSize: number;
}

function ElectronOrbit({ ring, radius, electronSize, containerSize }: ElectronOrbitProps) {
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
      {/* The visible ellipse ring — drawn as a bordered circle in the tilted plane */}
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
        {/* Electron dot — rotates around the ring center */}
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
            // The child is offset to the top-center of the ring, then
            // transform-origin is its own center compensated by the radius
            // so it orbits the ring center.
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
// A softly breathing core with layered glow rings to give depth.
interface NucleusProps {
  outerSize: number;
  innerSize: number;
}

function Nucleus({ outerSize, innerSize }: NucleusProps) {
  return (
    // Outer pulsing glow halo
    <motion.div
      animate={{
        scale: [1, 1.18, 1],
        opacity: [0.35, 0.55, 0.35],
      }}
      transition={{
        duration: 2.8,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      style={{
        position: "absolute",
        width: outerSize,
        height: outerSize,
        borderRadius: "50%",
        background:
          "radial-gradient(circle, rgba(139,92,246,0.4) 0%, rgba(139,92,246,0) 70%)",
      }}
    >
      {/* Inner solid core — slightly faster breathing in opposite phase */}
      <motion.div
        animate={{
          scale: [1, 1.08, 1],
        }}
        transition={{
          duration: 2.4,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.4,
        }}
        style={{
          position: "absolute",
          inset: 0,
          margin: "auto",
          width: innerSize,
          height: innerSize,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 38% 35%, #C4B5FD 0%, #8B5CF6 55%, #6D28D9 100%)",
          boxShadow:
            "0 0 12px 4px rgba(139,92,246,0.45), 0 0 2px 1px rgba(196,181,253,0.6)",
        }}
      />
    </motion.div>
  );
}

// ── SfinxSpinner ──────────────────────────────────────────────────────────────
export default function SfinxSpinner({
  size = "md",
  className = "",
  title,
  messages,
}: SfinxSpinnerProps) {
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

  // Map each ring to the correct radius from SIZE_MAP
  const ringRadii = s.rings; // [inner, mid, outer] radius values

  return (
    <motion.div
      className={`flex flex-col items-center ${className}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.15 }}
      style={{ marginTop: size === "lg" ? "-4rem" : "0" }}
    >
      {/* Atom container */}
      <div
        style={{
          position: "relative",
          width: s.container,
          height: s.container,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // perspective gives the 3-D tilt its visual depth
          perspective: s.container * 2.8,
        }}
      >
        {/* Three orbital rings + electrons */}
        {RINGS.map((ring, i) => (
          <ElectronOrbit
            key={i}
            ring={ring}
            radius={ringRadii[i]}
            electronSize={s.electron}
            containerSize={s.container}
          />
        ))}

        {/* Nucleus — centered absolutely */}
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

      {/* Title */}
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

      {/* Cycling message with AnimatePresence crossfade */}
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
