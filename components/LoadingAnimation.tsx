"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';

interface LoadingAnimationProps {
  statusText?: string;
  hasZip?: boolean;
  hasImages?: boolean;
}

export default function LoadingAnimation({ statusText, hasZip, hasImages }: LoadingAnimationProps) {
  const [dotCount, setDotCount] = useState(0);

  // Infinitely loop through 0 -> 1 -> 2 -> 3 dots every 400ms
  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount(prev => (prev + 1) % 4);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  const getLabel = () => {
    if (statusText) return statusText;
    if (hasZip) return "Inspecting files and context";
    if (hasImages) return "Analyzing visual data";
    return "Thinking";
  };

  const label = getLabel();
  const dots = ".".repeat(dotCount);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className="flex items-start gap-3.5 py-2.5"
    >
      {/* Assistant Avatar Badge */}
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-950 font-mono font-black text-xs shadow-xs">
        N
      </div>

      {/* Claude Dark Mode Styled Thinking Block */}
      <div className="flex flex-col gap-1.5 max-w-[85%]">
        <div className="inline-flex items-center gap-2 rounded-r-md border-l-2 border-amber-500/70 dark:border-amber-400/80 bg-neutral-900/5 dark:bg-slate-900/50 pl-3 py-1.5 pr-4 text-xs font-mono shadow-2xs">
          {/* Pulsing Star Symbol */}
          <span className="relative flex h-3.5 w-3.5 items-center justify-center shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-40"></span>
            <span className="relative text-amber-500 dark:text-amber-400 text-xs font-bold animate-pulse leading-none">
              ✦
            </span>
          </span>

          {/* Context-aware Dynamic Step Label */}
          <div className="flex items-center text-neutral-700 dark:text-slate-300 font-mono">
            <span className="font-medium">{label}</span>
            <span className="w-5 text-left font-bold text-amber-600 dark:text-amber-400 inline-block">
              {dots}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
