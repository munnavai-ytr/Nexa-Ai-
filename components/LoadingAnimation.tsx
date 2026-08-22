"use client";

import React from 'react';
import { motion } from 'motion/react';

export default function LoadingAnimation() {
  return (
    <div className="flex items-center gap-4 py-2">
      <motion.div 
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 font-extrabold text-lg shadow-[0_0_15px_rgba(0,0,0,0.5)] dark:shadow-[0_0_15px_rgba(255,255,255,0.5)]"
        animate={{ 
          boxShadow: [
            '0px 0px 10px rgba(0,0,0,0.2)', 
            '0px 0px 20px rgba(234,88,12,0.8)', 
            '0px 0px 10px rgba(0,0,0,0.2)'
          ] 
        }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      >
        N
      </motion.div>
      <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-neutral-100 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 text-neutral-500">
        <motion.span 
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
          className="text-sm font-medium text-neutral-500 dark:text-neutral-400"
        >
          Ai message typing and searching...
        </motion.span>
      </div>
    </div>
  );
}
