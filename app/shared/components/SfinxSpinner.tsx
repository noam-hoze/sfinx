"use client";

import { useEffect, useState } from "react";

type SfinxSpinnerProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
  title: string;
  messages: string | string[];
};

type CenterType = "head" | "brain" | "eye" | "breathing" | "spark" | "compass";

// Get center type from environment variable
const getCenterType = (): CenterType => {
  const type = process.env.NEXT_PUBLIC_SPINNER_CENTER_TYPE as CenterType || "head";
  return ["head", "brain", "eye", "breathing", "spark", "compass"].includes(type) ? type : "head";
};

// Center content components
function CenterContent({ type, size, nucleusSize }: { type: CenterType; size: "sm" | "md" | "lg"; nucleusSize: number }) {
  switch (type) {
    case "head": {
      // Subtle human head silhouette with soft glow
      return (
        <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
          <defs>
            <filter id="glow-head">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle cx="50" cy="35" r="20" fill="#c084fc" filter="url(#glow-head)" opacity="0.9" />
          <ellipse cx="50" cy="65" rx="18" ry="22" fill="#c084fc" filter="url(#glow-head)" opacity="0.7" />
        </svg>
      );
    }
    case "brain": {
      // Rotating brain/neural pattern
      return (
        <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", animation: "rotateSpin 4s linear infinite" }}>
          <defs>
            <filter id="glow-brain">
              <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle cx="30" cy="40" r="8" fill="#818cf8" filter="url(#glow-brain)" />
          <circle cx="70" cy="40" r="8" fill="#818cf8" filter="url(#glow-brain)" />
          <circle cx="50" cy="65" r="8" fill="#818cf8" filter="url(#glow-brain)" />
          <path d="M 30 40 Q 50 30 70 40" stroke="#818cf8" strokeWidth="2" fill="none" filter="url(#glow-brain)" opacity="0.6" />
          <path d="M 30 40 Q 50 70 70 40" stroke="#818cf8" strokeWidth="2" fill="none" filter="url(#glow-brain)" opacity="0.6" />
          <path d="M 30 40 L 50 65 L 70 40" stroke="#818cf8" strokeWidth="1.5" fill="none" filter="url(#glow-brain)" opacity="0.4" />
        </svg>
      );
    }
    case "eye": {
      // Glowing eye
      return (
        <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
          <defs>
            <filter id="glow-eye">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <ellipse cx="50" cy="50" rx="25" ry="30" fill="none" stroke="#22d3ee" strokeWidth="2" filter="url(#glow-eye)" opacity="0.8" />
          <circle cx="50" cy="50" r="14" fill="#22d3ee" filter="url(#glow-eye)" opacity="0.6" />
          <circle cx="50" cy="50" r="8" fill="#0891b2" filter="url(#glow-eye)" />
          <circle cx="54" cy="46" r="3" fill="white" filter="url(#glow-eye)" />
        </svg>
      );
    }
    case "breathing": {
      // Concentric circles with breathing motion
      return (
        <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", animation: "breathing 2.5s ease-in-out infinite" }}>
          <circle cx="50" cy="50" r="8" fill="#c084fc" opacity="0.9" />
          <circle cx="50" cy="50" r="16" fill="none" stroke="#c084fc" strokeWidth="1.5" opacity="0.6" />
          <circle cx="50" cy="50" r="24" fill="none" stroke="#c084fc" strokeWidth="1" opacity="0.3" />
        </svg>
      );
    }
    case "spark": {
      // Human profile with bright spark inside the head
      return (
        <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
          <defs>
            <filter id="glow-spark">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle cx="35" cy="38" r="18" fill="#a78bfa" filter="url(#glow-spark)" opacity="0.8" />
          <ellipse cx="35" cy="62" rx="16" ry="18" fill="#a78bfa" filter="url(#glow-spark)" opacity="0.6" />
          <circle cx="32" cy="32" r="4" fill="#fbbf24" filter="url(#glow-spark)" opacity="1" />
          <circle cx="32" cy="32" r="2.5" fill="#fef3c7" filter="url(#glow-spark)" />
        </svg>
      );
    }
    case "compass": {
      // Rotating compass/aperture
      return (
        <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", animation: "rotateSpin 6s linear infinite" }}>
          <defs>
            <filter id="glow-compass">
              <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle cx="50" cy="50" r="22" fill="none" stroke="#06b6d4" strokeWidth="2" filter="url(#glow-compass)" opacity="0.8" />
          <path d="M 50 28 L 50 35 M 50 65 L 50 72 M 28 50 L 35 50 M 65 50 L 72 50" stroke="#06b6d4" strokeWidth="2" filter="url(#glow-compass)" opacity="0.6" />
          <circle cx="50" cy="50" r="6" fill="#06b6d4" filter="url(#glow-compass)" opacity="0.9" />
          <path d="M 50 50 L 50 35" stroke="#fbbf24" strokeWidth="1.5" filter="url(#glow-compass)" opacity="0.7" />
        </svg>
      );
    }
    default:
      return null;
  }
}

/**
 * Animated atom-inspired spinner used across Sfinx loading experiences.
 * Center element can be changed via NEXT_PUBLIC_SPINNER_CENTER_TYPE environment variable:
 * - "head": Subtle human head silhouette with soft glow (default)
 * - "brain": Rotating brain/neural pattern
 * - "eye": Glowing eye
 * - "breathing": Concentric circles with breathing motion
 * - "spark": Human profile with bright spark inside head
 * - "compass": Rotating compass/aperture
 */
export default function SfinxSpinner({ size = "md", className = "", title, messages }: SfinxSpinnerProps) {
  const sizes = {
    sm: { atom: 24, nucleus: 4, orbit: 14, electron: 2, fontSize: '8px' },
    md: { atom: 300, nucleus: 25, orbit: 170, electron: 10, fontSize: '28px' },
    lg: { atom: 450, nucleus: 35, orbit: 255, electron: 14, fontSize: '42px' },
  };

  const s = sizes[size];
  const centerType = getCenterType();

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
    <div className="text-center -mt-32">
    <div className={`atom ${className}`} style={{ opacity: 0 }}>
      <div className="nucleus">
        <CenterContent type={centerType} size={size} nucleusSize={s.nucleus} />
      </div>
      
      <div className="orbit orbit-1">
        <div className="electron"></div>
      </div>
      
      <div className="orbit orbit-2">
        <div className="electron"></div>
      </div>
      
      <div className="orbit orbit-3">
        <div className="electron"></div>
      </div>

      <style jsx>{`
        .atom {
          position: relative;
          width: ${s.atom}px;
          height: ${s.atom}px;
          display: inline-block;
          margin: 10px auto;
          opacity: 0;
          animation: fadeIn 0.5s ease-in 0.2s forwards;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes rotateSpin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes breathing {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
        }

        .nucleus,
        .orbit,
        .electron {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          margin: auto;
          border-radius: 50%;
        }

        .nucleus {
          width: ${s.nucleus}px;
          height: ${s.nucleus}px;
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }

        .orbit::before {
          content: " ";
          position: absolute;
          z-index: -1;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border: 0.5px solid rgba(124, 58, 237, 0.1);
          border-radius: 50%;
        }

        .orbit {
          width: ${s.orbit}px;
          height: ${s.orbit}px;
          border: 0;
          transform-style: preserve-3d;
        }

        .electron {
          position: relative;
          top: ${(s.orbit - s.electron) / 2}px;
          width: ${s.electron}px;
          height: ${s.electron}px;
          border-radius: 50%;
          transform: translateX(${s.orbit / 2}px);
          animation: electronAnimation 1.5s infinite linear;
          opacity: 0;
        }

        .orbit-1 .electron {
          background: #c084fc;
          box-shadow: 0 0 15px #c084fc;
        }

        .orbit-2 .electron {
          background: #818cf8;
          box-shadow: 0 0 15px #818cf8;
        }

        .orbit-3 .electron {
          background: #22d3ee;
          box-shadow: 0 0 15px #22d3ee;
        }

        .orbit-1 {
          transform: rotateY(65deg) rotateX(5deg);
          animation: orbitTrail1 2s infinite ease-in-out;
        }

        .orbit-1 .electron {
          animation-delay: -1s;
        }

        .orbit-2 {
          transform: rotateY(65deg) rotateX(-54deg);
          animation: orbitTrail2 2.5s infinite ease-in-out;
        }

        .orbit-2 .electron {
          animation-duration: 2s;
        }

        .orbit-3 {
          transform: rotateY(65deg) rotateX(54deg);
          animation: orbitTrail3 2s infinite ease-in-out;
        }

        @keyframes electronAnimation {
          0% {
            transform: rotateZ(0deg) translateX(${s.orbit / 2}px) rotateZ(-0deg) rotateY(-65deg);
          }
          100% {
            transform: rotateZ(360deg) translateX(${s.orbit / 2}px) rotateZ(-360deg) rotateY(-65deg);
          }
        }

        @keyframes orbitTrail1 {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(192, 132, 252, 0), inset 0 0 20px rgba(192, 132, 252, 0.1);
          }
          25% {
            box-shadow: 0 -20px 30px 10px rgba(192, 132, 252, 0.4), inset 0 0 20px rgba(192, 132, 252, 0.15);
          }
          50% {
            box-shadow: 20px 0 30px 10px rgba(192, 132, 252, 0.4), inset 0 0 20px rgba(192, 132, 252, 0.15);
          }
          75% {
            box-shadow: 0 20px 30px 10px rgba(192, 132, 252, 0.4), inset 0 0 20px rgba(192, 132, 252, 0.15);
          }
        }

        @keyframes orbitTrail2 {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(129, 140, 248, 0), inset 0 0 20px rgba(129, 140, 248, 0.1);
          }
          25% {
            box-shadow: 0 -20px 30px 10px rgba(129, 140, 248, 0.4), inset 0 0 20px rgba(129, 140, 248, 0.15);
          }
          50% {
            box-shadow: 20px 0 30px 10px rgba(129, 140, 248, 0.4), inset 0 0 20px rgba(129, 140, 248, 0.15);
          }
          75% {
            box-shadow: 0 20px 30px 10px rgba(129, 140, 248, 0.4), inset 0 0 20px rgba(129, 140, 248, 0.15);
          }
        }

        @keyframes orbitTrail3 {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(34, 211, 238, 0), inset 0 0 20px rgba(34, 211, 238, 0.1);
          }
          25% {
            box-shadow: 0 -20px 30px 10px rgba(34, 211, 238, 0.4), inset 0 0 20px rgba(34, 211, 238, 0.15);
          }
          50% {
            box-shadow: 20px 0 30px 10px rgba(34, 211, 238, 0.4), inset 0 0 20px rgba(34, 211, 238, 0.15);
          }
          75% {
            box-shadow: 0 20px 30px 10px rgba(34, 211, 238, 0.4), inset 0 0 20px rgba(34, 211, 238, 0.15);
          }
        }
      `}</style>
    </div>
    <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 dark:text-white mb-4">
      {title}
    </h2>
    <p className="text-base md:text-lg text-gray-600 dark:text-gray-300">
      <span 
        key={currentMessageIndex} 
        className="transition-opacity duration-[2000ms] opacity-0"
        style={{ animation: 'fadeIn 0.5s ease-in forwards' }}
      >
        {messageArray[currentMessageIndex]}
      </span>
    </p>
    </div>
  );
}

