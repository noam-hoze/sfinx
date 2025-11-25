"use client";

import { useEffect, useState } from "react";

type SfinxSpinnerProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
  title: string;
  messages: string | string[];
};

/**
 * Animated atom-inspired spinner used across Sfinx loading experiences.
 */
export default function SfinxSpinner({ size = "md", className = "", title, messages }: SfinxSpinnerProps) {
  const sizes = {
    sm: { atom: 24, nucleus: 4, orbit: 14, electron: 2, fontSize: '8px' },
    md: { atom: 300, nucleus: 25, orbit: 170, electron: 10, fontSize: '28px' },
    lg: { atom: 450, nucleus: 35, orbit: 255, electron: 14, fontSize: '42px' },
  };
  
  const s = sizes[size];
  
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
        <span className="nucleus-text">S</span>
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

        .nucleus-text {
          color: #7c3aed;
          font-weight: bold;
          font-size: ${s.fontSize};
          text-shadow: 0 0 10px rgba(124, 58, 237, 0.5);
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

