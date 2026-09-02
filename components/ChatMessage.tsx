"use client";

import React, { useCallback } from "react";
import { Terminal, ImageIcon, FolderArchive, RefreshCw, FileText, ChevronUp, ChevronDown } from "lucide-react";
import ClaudeThinkingIndicator from "./ClaudeThinkingIndicator";
import MarkdownRenderer from "./MarkdownRenderer";

export interface ChatMessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  attachedImage?: { fileName: string; dataUrl: string };
  attachedImages?: { fileName: string; dataUrl: string }[];
  attachedZip?: { fileName: string; totalFiles: number; totalSizeKb: number };
  sourceType?: string;
  sources?: { filename: string; score: number; snippet: string }[];
  usage?: { promptTokens?: number; candidatesTokens?: number; totalTokens?: number };
}

interface ChatMessageProps {
  message: ChatMessageData;
  isStreamingActive: boolean;
  aiActionStatus: string | null;
  hasZipBefore: boolean;
  hasImagesBefore: boolean;
  copySuccessId: string | null;
  onCopy: (text: string, id: string) => void;
  onRetry: (prompt: string) => void;
  onPreviewImage: (img: { fileName: string; dataUrl: string }) => void;
  expandedSources: Record<string, boolean>;
  onToggleSource: (key: string) => void;
  previousUserPrompt?: string;
}

export const ChatMessage = React.memo(
  function ChatMessage({
    message,
    isStreamingActive,
    aiActionStatus,
    hasZipBefore,
    hasImagesBefore,
    copySuccessId,
    onCopy,
    onRetry,
    onPreviewImage,
    expandedSources,
    onToggleSource,
    previousUserPrompt
  }: ChatMessageProps) {
    const isUser = message.role === "user";

    const handleRetryClick = useCallback(() => {
      if (previousUserPrompt) {
        onRetry(previousUserPrompt);
      }
    }, [previousUserPrompt, onRetry]);

    return (
      <div
        id={`chat-message-${message.id}`}
        className={`flex gap-3 sm:gap-4 ${isUser ? "justify-end" : "justify-start"} hardware-accelerated`}
      >
        {/* Assistant Avatar */}
        {!isUser && (
          <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-bold border border-neutral-300/20 dark:border-neutral-700/20 shadow-2xs">
            <Terminal className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-800 dark:text-amber-400" />
          </div>
        )}

        {/* Message Bubble Container */}
        <div
          className={`max-w-[90%] sm:max-w-[85%] rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-sm leading-relaxed ${
            isUser
              ? "bg-amber-900/5 dark:bg-amber-100/10 border border-amber-900/10 dark:border-amber-100/10 text-neutral-800 dark:text-neutral-200 shadow-2xs"
              : "text-neutral-800 dark:text-neutral-100"
          }`}
        >
          {/* Header info */}
          <div className="flex items-center gap-2 mb-1 justify-between select-none">
            <span className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-wider">
              {isUser ? (
                "You"
              ) : (
                <div className="flex items-center gap-2">
                  <span>Assistant</span>
                  {message.sourceType && (
                    <span
                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider normal-case ${
                        message.sourceType === "Global Library"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : message.sourceType === "Deep Research"
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                      }`}
                    >
                      {message.sourceType === "Global Library"
                        ? "🟢 Global Library"
                        : message.sourceType === "Deep Research"
                        ? "🌐 Deep Research"
                        : "🧠 Nexa Brain"}
                    </span>
                  )}
                </div>
              )}
            </span>
            <span className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500">
              {message.timestamp}
            </span>
          </div>

          {/* User Attachments and Content */}
          {isUser ? (
            <div>
              {/* Multi-Image Gallery */}
              {message.attachedImages && message.attachedImages.length > 0 ? (
                <div className="mb-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-500 dark:text-neutral-400 mb-1.5">
                    <ImageIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    <span>
                      {message.attachedImages.length} Image{message.attachedImages.length > 1 ? "s" : ""} Attached
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {message.attachedImages.map((img, imgIdx) => (
                      <div
                        key={imgIdx}
                        onClick={() => onPreviewImage(img)}
                        className="group relative h-20 w-20 sm:h-24 sm:w-24 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-900/10 dark:bg-neutral-900/60 cursor-pointer shadow-xs hover:border-blue-500/50 transition-all"
                        title={`Click to preview ${img.fileName}`}
                      >
                        <img
                          src={img.dataUrl}
                          alt={img.fileName}
                          loading="lazy"
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1">
                          <p className="text-[9px] font-mono text-white truncate text-center">{img.fileName}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : message.attachedImage ? (
                <div
                  onClick={() => onPreviewImage(message.attachedImage!)}
                  className="mb-2.5 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-900/5 dark:bg-neutral-900/50 max-w-sm cursor-pointer group"
                  title="Click to preview image"
                >
                  <img
                    src={message.attachedImage.dataUrl}
                    alt={message.attachedImage.fileName}
                    loading="lazy"
                    className="max-h-64 w-auto rounded-lg object-contain group-hover:opacity-95 transition-opacity"
                  />
                  <div className="px-2.5 py-1 text-[10px] font-mono text-neutral-500 dark:text-neutral-400 truncate flex items-center gap-1.5">
                    <ImageIcon className="h-3 w-3 text-blue-500 shrink-0" />
                    <span className="truncate">{message.attachedImage.fileName}</span>
                  </div>
                </div>
              ) : null}

              {/* Attached ZIP Banner */}
              {message.attachedZip && (
                <div className="mb-2 flex items-center gap-2.5 rounded-xl bg-amber-950/5 dark:bg-amber-100/10 border border-amber-900/15 dark:border-amber-100/15 px-3 py-1.5 text-xs">
                  <FolderArchive className="h-4 w-4 text-amber-800 dark:text-amber-300 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="font-mono font-bold text-amber-950 dark:text-amber-100 truncate block">
                      {message.attachedZip.fileName}
                    </span>
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
                      {message.attachedZip.totalFiles} code files analyzed · {message.attachedZip.totalSizeKb} KB
                    </span>
                  </div>
                </div>
              )}

              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          ) : (
            /* Assistant Markdown Rendering */
            <div className="space-y-2 min-w-0">
              {/* Dynamic Live Thinking Indicator strictly GPU composited */}
              {isStreamingActive && (
                <ClaudeThinkingIndicator
                  statusText={aiActionStatus || undefined}
                  isStreaming={message.content.length > 0}
                  hasZip={hasZipBefore}
                  hasImages={hasImagesBefore}
                />
              )}

              {/* Memoized Markdown & CodeBlock */}
              {message.content ? (
                <MarkdownRenderer
                  content={message.content}
                  messageId={message.id}
                  onCopy={onCopy}
                  copySuccessId={copySuccessId}
                />
              ) : null}

              {/* Retry button for failures */}
              {(message.content.includes("503") ||
                message.content.includes("heavy traffic") ||
                message.content.includes("Rate limit") ||
                message.content.includes("Authentication") ||
                message.content.includes("⚠️")) &&
                previousUserPrompt && (
                  <div className="mt-2.5 pt-1.5 flex items-center">
                    <button
                      type="button"
                      onClick={handleRetryClick}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-900/10 hover:bg-amber-900/20 dark:bg-amber-100/10 dark:hover:bg-amber-100/20 text-amber-900 dark:text-amber-200 text-xs font-medium transition-all cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Retry Request</span>
                    </button>
                  </div>
                )}

              {/* RAG Source Attribution Badges */}
              {message.sources && message.sources.length > 0 && (
                <div className="mt-3.5 pt-2.5 border-t border-neutral-200/50 dark:border-neutral-800/50 space-y-1.5">
                  <span className="text-[10px] font-mono font-bold tracking-wider text-neutral-400 dark:text-neutral-500 uppercase select-none">
                    Retrieved Reference Sources:
                  </span>
                  <div className="space-y-1">
                    {message.sources.map((src, sIdx) => {
                      const sourceKey = `${message.id}-${sIdx}`;
                      const isExpanded = !!expandedSources[sourceKey];
                      return (
                        <div
                          key={sIdx}
                          className="rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 bg-neutral-100/50 dark:bg-neutral-900/50 overflow-hidden text-xs"
                        >
                          <button
                            id={`toggle-source-btn-${sourceKey}`}
                            type="button"
                            onClick={() => onToggleSource(sourceKey)}
                            className="flex items-center justify-between w-full p-2 hover:bg-neutral-200/30 dark:hover:bg-neutral-800/30 transition-colors text-left cursor-pointer"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="h-3.5 w-3.5 text-amber-800 dark:text-amber-400 shrink-0" />
                              <span className="font-semibold text-neutral-700 dark:text-neutral-200 truncate">
                                {src.filename}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 tracking-wider">
                                {src.score}% Match
                              </span>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5 text-neutral-400" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
                            )}
                          </button>

                          {isExpanded && (
                            <div className="p-2.5 bg-[#FBF9F6] dark:bg-[#080808] border-t border-neutral-200/50 dark:border-neutral-800/50 font-mono text-[11px] leading-relaxed text-neutral-600 dark:text-neutral-400 overflow-x-auto whitespace-pre-wrap select-all">
                              {src.snippet}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom strict memoization comparator to ensure historical messages NEVER re-render during streaming
    if (prevProps.message.id !== nextProps.message.id) return false;
    if (prevProps.message.content !== nextProps.message.content) return false;
    if (prevProps.isStreamingActive !== nextProps.isStreamingActive) return false;

    // Only compare status text if this message is actively streaming
    if (nextProps.isStreamingActive && prevProps.aiActionStatus !== nextProps.aiActionStatus) {
      return false;
    }

    // Check if copy state changed for this specific message
    const prevCopied = prevProps.copySuccessId?.startsWith(prevProps.message.id);
    const nextCopied = nextProps.copySuccessId?.startsWith(nextProps.message.id);
    if (prevCopied !== nextCopied) return false;

    // Check sources expansion
    if (prevProps.message.sources && prevProps.message.sources.length > 0) {
      for (let i = 0; i < prevProps.message.sources.length; i++) {
        const key = `${prevProps.message.id}-${i}`;
        if (!!prevProps.expandedSources[key] !== !!nextProps.expandedSources[key]) {
          return false;
        }
      }
    }

    if (prevProps.previousUserPrompt !== nextProps.previousUserPrompt) return false;

    return true;
  }
);

export default ChatMessage;
