"use client";

import React from "react";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  language: string;
  code: string;
  messageId: string;
  isCopied: boolean;
  onCopy: (code: string, copyId: string) => void;
  children?: React.ReactNode;
}

export const CodeBlock = React.memo(function CodeBlock({
  language,
  code,
  messageId,
  isCopied,
  onCopy,
  children
}: CodeBlockProps) {
  const copyTargetId = `${messageId}-code-${language}`;

  return (
    <div className="relative group my-3 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 font-mono text-xs shadow-md max-w-full hardware-accelerated">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-900 border-b border-slate-800 text-[10px] text-slate-400 font-bold font-mono uppercase tracking-wider select-none">
        <span>{language || "code"}</span>
        <button
          id={`copy-code-bubble-button-${messageId}-${language}`}
          type="button"
          onClick={() => onCopy(code, copyTargetId)}
          className="hover:text-amber-400 text-slate-400 flex items-center gap-1 transition-colors cursor-pointer py-0.5 px-1.5 rounded"
          title="Copy code to clipboard"
        >
          {isCopied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400 animate-bounce" />
              <span className="text-emerald-400 normal-case font-sans">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span className="font-sans">Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto max-w-full text-xs sm:text-sm font-mono whitespace-pre rounded-b-lg p-3 bg-slate-900 border-t-0 border border-slate-800 text-slate-100 leading-relaxed [touch-action:pan-x] overscroll-x-contain">
        <code className="font-mono text-xs sm:text-sm text-slate-100">
          {children || code}
        </code>
      </pre>
    </div>
  );
});

export default CodeBlock;
