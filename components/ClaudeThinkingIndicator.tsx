"use client";

import React from "react";
import { motion } from "motion/react";

interface ClaudeThinkingIndicatorProps {
  statusText?: string;
  hasZip?: boolean;
  hasImages?: boolean;
  isStreaming?: boolean;
}

export default React.memo(function ClaudeThinkingIndicator({
  statusText,
  hasZip,
  hasImages,
  isStreaming = false
}: ClaudeThinkingIndicatorProps) {
  // Compute dynamic context-aware step label without main-thread interval overhead
  const getBaseLabel = () => {
    if (statusText) return statusText;
    if (isStreaming) return "Generating response";
    if (hasZip) return "Inspecting files and context";
    if (hasImages) return "Analyzing visual data";
    return "Thinking";
  };

  const baseLabel = getBaseLabel();

  return (
    <motion.div
      initial={{ opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -3 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      style={{ willChange: "transform, opacity" }}
      className="inline-flex items-center gap-2 rounded-r-md border-l-2 border-amber-500/70 dark:border-amber-400/80 bg-neutral-900/5 dark:bg-slate-900/50 pl-3 py-1.5 pr-3.5 text-xs font-mono text-neutral-600 dark:text-slate-300 shadow-2xs select-none mb-2"
    >
      {/* Strictly GPU-accelerated Pulsing Star (opacity & transform only) */}
      <span className="relative flex h-3.5 w-3.5 items-center justify-center shrink-0">
        <span 
          className="absolute inline-flex h-full w-full rounded-full bg-amber-400/40 animate-ping"
          style={{ willChange: "transform, opacity" }}
        />
        <span 
          className="relative text-amber-500 dark:text-amber-400 text-sm font-bold animate-pulse leading-none"
          style={{ willChange: "opacity" }}
        >
          ✦
        </span>
      </span>

      {/* Label with pure CSS GPU-composited animated pulsing dots (no width, margin, or padding repaints) */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="font-medium tracking-tight text-neutral-800 dark:text-slate-200">
          {baseLabel}
        </span>
        <div className="flex items-center gap-0.5 ml-0.5" aria-hidden="true">
          <span 
            className="inline-block h-1 w-1 rounded-full bg-amber-600 dark:bg-amber-400 animate-pulse" 
            style={{ animationDuration: "1s", animationDelay: "0ms", willChange: "opacity" }} 
          />
          <span 
            className="inline-block h-1 w-1 rounded-full bg-amber-600 dark:bg-amber-400 animate-pulse" 
            style={{ animationDuration: "1s", animationDelay: "250ms", willChange: "opacity" }} 
          />
          <span 
            className="inline-block h-1 w-1 rounded-full bg-amber-600 dark:bg-amber-400 animate-pulse" 
            style={{ animationDuration: "1s", animationDelay: "500ms", willChange: "opacity" }} 
          />
        </div>
      </div>
    </motion.div>
  );
});

