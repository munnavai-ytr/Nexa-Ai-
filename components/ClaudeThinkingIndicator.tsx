"use client";

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";

interface ClaudeThinkingIndicatorProps {
  statusText?: string;
  hasZip?: boolean;
  hasImages?: boolean;
  isStreaming?: boolean;
}

export default function ClaudeThinkingIndicator({
  statusText,
  hasZip,
  hasImages,
  isStreaming = false
}: ClaudeThinkingIndicatorProps) {
  const [dotCount, setDotCount] = useState(0);

  // Smoothly loop dot count 0 -> 1 -> 2 -> 3 -> 0 every 400ms
  useEffect(() => {
    const timer = setInterval(() => {
      setDotCount((prev) => (prev + 1) % 4);
    }, 400);

    return () => clearInterval(timer);
  }, []);

  // Compute dynamic context-aware step label
  const getBaseLabel = () => {
    if (statusText) return statusText;
    if (isStreaming) return "Generating response";
    if (hasZip) return "Inspecting files and context";
    if (hasImages) return "Analyzing visual data";
    return "Thinking";
  };

  const baseLabel = getBaseLabel();
  const dots = ".".repeat(dotCount);

  return (
    <motion.div
      initial={{ opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -3 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="inline-flex items-center gap-2.5 rounded-r-md border-l-2 border-amber-500/70 dark:border-amber-400/80 bg-neutral-900/5 dark:bg-slate-900/50 pl-3 py-1.5 pr-4 text-xs font-mono text-neutral-600 dark:text-slate-300 shadow-2xs select-none mb-2"
    >
      {/* Glowing / Pulsing Sparkle Star */}
      <span className="relative flex h-3.5 w-3.5 items-center justify-center shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-40"></span>
        <span className="relative text-amber-500 dark:text-amber-400 text-sm font-bold animate-pulse leading-none">
          ✦
        </span>
      </span>

      {/* Label with dynamic animated dots */}
      <div className="flex items-center min-w-0">
        <span className="font-medium tracking-tight text-neutral-800 dark:text-slate-200">
          {baseLabel}
        </span>
        <span className="w-5 text-left font-bold text-amber-600 dark:text-amber-400 inline-block font-mono">
          {dots}
        </span>
      </div>
    </motion.div>
  );
}
