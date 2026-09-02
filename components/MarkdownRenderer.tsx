"use client";

import React, { useMemo } from "react";
import Markdown from "react-markdown";
import CodeBlock from "./CodeBlock";

interface MarkdownRendererProps {
  content: string;
  messageId: string;
  onCopy: (text: string, id: string) => void;
  copySuccessId: string | null;
}

export const MarkdownRenderer = React.memo(
  function MarkdownRenderer({
    content,
    messageId,
    onCopy,
    copySuccessId
  }: MarkdownRendererProps) {
    const components = useMemo(() => {
      return {
        p({ children }: { children?: React.ReactNode }) {
          return <p className="mb-3 leading-relaxed last:mb-0">{children}</p>;
        },
        ul({ children }: { children?: React.ReactNode }) {
          return <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>;
        },
        ol({ children }: { children?: React.ReactNode }) {
          return <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>;
        },
        li({ children }: { children?: React.ReactNode }) {
          return <li className="leading-relaxed">{children}</li>;
        },
        h1({ children }: { children?: React.ReactNode }) {
          return <h1 className="text-xl font-bold text-neutral-800 dark:text-neutral-100 mt-5 mb-2.5">{children}</h1>;
        },
        h2({ children }: { children?: React.ReactNode }) {
          return <h2 className="text-lg font-bold text-neutral-800 dark:text-neutral-150 mt-4 mb-2">{children}</h2>;
        },
        h3({ children }: { children?: React.ReactNode }) {
          return <h3 className="text-base font-bold text-neutral-800 dark:text-neutral-200 mt-4 mb-2">{children}</h3>;
        },
        pre({ children }: { children?: React.ReactNode }) {
          return (
            <pre className="overflow-x-auto max-w-full text-xs sm:text-sm font-mono whitespace-pre rounded-lg p-3 bg-slate-900 border border-slate-800 text-slate-100 my-3 leading-relaxed [touch-action:pan-x] overscroll-x-contain">
              {children}
            </pre>
          );
        },
        code({ className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || "");
          const isInline = !match;
          const codeContent = String(children).replace(/\n$/, "");

          if (isInline) {
            return (
              <code
                className="bg-neutral-150 dark:bg-neutral-800/80 px-1.5 py-0.5 rounded text-xs font-mono font-semibold text-amber-800 dark:text-amber-300"
                {...props}
              >
                {children}
              </code>
            );
          }

          const lang = match ? match[1] : "code";
          const copyKey = `${messageId}-code-${lang}`;
          const isCopied = copySuccessId === copyKey || copySuccessId === (messageId + "-code");

          return (
            <CodeBlock
              language={lang}
              code={codeContent}
              messageId={messageId}
              isCopied={isCopied}
              onCopy={onCopy}
            >
              {children}
            </CodeBlock>
          );
        }
      };
    }, [messageId, onCopy, copySuccessId]);

    return (
      <div className="markdown-content min-w-0">
        <Markdown components={components}>{content}</Markdown>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Strict memoization: skip re-rendering if content and copy states haven't changed
    if (prevProps.content !== nextProps.content) return false;
    if (prevProps.messageId !== nextProps.messageId) return false;

    const wasCopied = prevProps.copySuccessId?.startsWith(prevProps.messageId);
    const isCopied = nextProps.copySuccessId?.startsWith(nextProps.messageId);
    if (wasCopied !== isCopied) return false;

    return true;
  }
);

export default MarkdownRenderer;
