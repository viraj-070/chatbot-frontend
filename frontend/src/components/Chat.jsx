import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  ChevronDown,
  Copy,
  Check,
  ArrowDown,
  Square,
  Send,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlock from "./CodeBlock";

export default function Chat({
  messages,
  onSend,
  onStop,
  availableModels,
  selectedModel,
  onModelChange,
  busy,
  status,
  isStorageFull,
  searchQuery,
  matchedMessageIndexes,
  activeSearchMessageIndex,
  jumpTarget,
  onOpenSandboxFromCode,
}) {
  const [input, setInput] = useState("");
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const endRef = useRef(null);
  const textareaRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const modelMenuRef = useRef(null);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 44), 200);
    textarea.style.height = `${newHeight}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!modelMenuRef.current?.contains(event.target)) {
        setIsModelMenuOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsModelMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  // Detect scroll position for scroll button visibility
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollButton(!isAtBottom);
  }, []);

  function scrollToBottom() {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || busy || isStorageFull) return;
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }
    onSend(trimmed);
    // Only scroll on prompt submit
    setTimeout(() => {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 50);
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  }

  function formatTime(date) {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  async function copyToClipboard(text, index) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }

  function extractResponse(content) {
    const match = content.match(/<\/think>\s*(.*)/s);
    return match ? match[1].trim() : content;
  }

  function hasThinkingTag(content) {
    return content.includes("<think>") || content.includes("</think>");
  }

  const selectedModelLabel =
    availableModels.find((model) => model.id === selectedModel)?.label ||
    "Choose model";
  const matchedMessageIndexSet = useMemo(
    () => new Set(matchedMessageIndexes || []),
    [matchedMessageIndexes],
  );

  useEffect(() => {
    if (!jumpTarget || typeof jumpTarget.messageIndex !== "number") return;

    const container = messagesContainerRef.current;
    if (!container) return;

    const targetNode = container.querySelector(
      `[data-message-index="${jumpTarget.messageIndex}"]`,
    );

    if (!targetNode) return;

    targetNode.scrollIntoView({ behavior: "smooth", block: "center" });
    targetNode.classList.add("search-jump-flash");
    const timer = window.setTimeout(() => {
      targetNode.classList.remove("search-jump-flash");
    }, 1300);

    return () => window.clearTimeout(timer);
  }, [jumpTarget]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-gray-50 dark:bg-slate-950">
      <style>{`
        /* Basic scrollbar */
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 9999px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #475569;
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }
        .dark .custom-scrollbar {
          scrollbar-color: #475569 transparent;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .animate-thinking {
          animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        .streaming-cursor {
          display: inline-block;
          width: 2px;
          height: 1em;
          background: #ea580c;
          margin-left: 2px;
          animation: cursorBlink 1s ease-in-out infinite;
          vertical-align: text-bottom;
        }
        
        /* Prevent text cursor everywhere */
        .chat-container * {
          cursor: default;
        }
        .chat-container .selectable-text,
        .chat-container .selectable-text * {
          cursor: text;
        }
        .chat-container button {
          cursor: pointer;
        }
        .chat-container textarea {
          cursor: text;
        }

        .model-menu-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .model-menu-scrollbar::-webkit-scrollbar-track {
          background: transparent;
          border-radius: 9999px;
        }
        .model-menu-scrollbar::-webkit-scrollbar-thumb {
          background: #94a3b8;
          border-radius: 9999px;
        }
        .dark .model-menu-scrollbar::-webkit-scrollbar-thumb {
          background: #64748b;
        }
        .model-menu-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #94a3b8 transparent;
        }
        .dark .model-menu-scrollbar {
          scrollbar-color: #64748b transparent;
        }
      `}</style>

      <div className="chat-container flex min-h-0 w-full flex-1 flex-col dark:bg-slate-950">
        {/* Messages container */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="relative flex-1 overflow-y-auto custom-scrollbar px-3 py-4 sm:px-4 dark:bg-slate-950"
        >
          <div className="w-full max-w-3xl mx-auto space-y-4">
            {messages.length === 0 && (
              <div className="mx-auto mt-12 w-full max-w-2xl rounded-lg border border-gray-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100">
                  Start a conversation
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
                  Ask anything below, or click one of these starter prompts.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[
                    "Build a simple React component example",
                    "Explain this code in beginner language",
                    "Help me debug my frontend error",
                    "Write HTML, CSS and JS demo code",
                  ].map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => onSend(suggestion)}
                      className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message, index) => {
              const mine = message.role === "user";
              const isStreaming = message.streaming;
              const hasThinking = hasThinkingTag(message.content);
              const isMatched =
                Boolean(searchQuery?.trim()) &&
                matchedMessageIndexSet.has(index);
              const isActiveMatch = activeSearchMessageIndex === index;
              const displayContent = hasThinking
                ? extractResponse(message.content)
                : message.content;

              if (!mine && !isStreaming && !displayContent) return null;

              return (
                <div
                  key={index}
                  data-message-index={index}
                  className={`search-message-anchor flex ${mine ? "justify-end" : "justify-start"} mb-2 rounded-2xl px-1 py-1 transition-colors ${
                    isActiveMatch
                      ? "search-match-active"
                      : isMatched
                        ? "search-match"
                        : ""
                  }`}
                >
                  {mine ? (
                    <div className="flex flex-col items-end max-w-[85%] sm:max-w-[75%]">
                      <div className="w-fit whitespace-pre-wrap break-words rounded-lg bg-orange-500 px-4 py-2.5 text-sm text-white sm:text-base">
                        {displayContent}
                      </div>
                      <span className="text-[10px] text-gray-400 mt-1.5 px-1 font-medium">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                  ) : (
                    <div className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                      {isStreaming && !displayContent ? (
                        <div className="flex items-center gap-2 py-2">
                          <span className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">
                            {status}
                          </span>
                          <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-thinking"></div>
                            <div
                              className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-thinking"
                              style={{ animationDelay: "0.2s" }}
                            ></div>
                            <div
                              className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-thinking"
                              style={{ animationDelay: "0.4s" }}
                            ></div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="selectable-text prose prose-sm max-w-none text-sm text-gray-800 dark:prose-invert dark:text-slate-100 [&_p]:mb-2 [&_table]:min-w-full [&_table]:border-collapse [&_table]:text-sm [&_th]:border [&_th]:border-gray-300 dark:[&_th]:border-slate-700 [&_th]:bg-gray-100 dark:[&_th]:bg-slate-800 [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-gray-300 dark:[&_td]:border-slate-700 [&_td]:px-2 [&_td]:py-1 [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 dark:[&_blockquote]:border-slate-600 [&_blockquote]:pl-3 [&_blockquote]:italic">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                table({ children, ...props }) {
                                  return (
                                    <div className="overflow-x-auto my-3 -mx-1 px-1">
                                      <table {...props}>{children}</table>
                                    </div>
                                  );
                                },
                                code({
                                  inline,
                                  className,
                                  children,
                                  ...props
                                }) {
                                  const match = /language-(\w+)/.exec(
                                    className || "",
                                  );
                                  const language = match ? match[1] : "";
                                  const codeContent = String(children).replace(
                                    /\n$/,
                                    "",
                                  );

                                  return !inline && match ? (
                                    <CodeBlock
                                      language={language}
                                      code={codeContent}
                                      onOpenSandbox={onOpenSandboxFromCode}
                                    />
                                  ) : (
                                    <code
                                      className="break-all rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-pink-700 dark:bg-slate-800 dark:text-orange-300 sm:text-sm"
                                      {...props}
                                    >
                                      {children}
                                    </code>
                                  );
                                },
                              }}
                            >
                              {displayContent}
                            </ReactMarkdown>
                          </div>
                          {isStreaming && displayContent && (
                            <span className="streaming-cursor"></span>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] text-gray-400 dark:text-slate-500">
                              {formatTime(message.timestamp)}
                            </span>
                            {!isStreaming && displayContent && (
                              <button
                                onClick={() =>
                                  copyToClipboard(displayContent, index)
                                }
                                className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800"
                              >
                                {copiedIndex === index ? (
                                  <Check className="w-3.5 h-3.5 text-green-500 dark:text-green-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5 text-orange-400 dark:text-orange-500 hover:text-orange-600 dark:hover:text-orange-400" />
                                )}
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        </div>

        {/* Scroll to bottom button */}
        {showScrollButton && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 z-20 flex h-9 w-9 items-center justify-center rounded-md bg-gray-800 text-white transition-colors hover:bg-gray-700 dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Input area */}
      <div className="relative w-full border-t border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        {isStorageFull && (
          <div className="absolute -top-11 left-1/2 z-30 w-max max-w-[90%] -translate-x-1/2 rounded-md border border-red-300 bg-red-100 px-3 py-1.5 text-center text-xs font-medium text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400 sm:text-sm">
            Storage is full. Clear a chat to continue.
          </div>
        )}
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex w-full max-w-3xl flex-col gap-2 p-3 sm:p-4"
        >
          <div className="flex justify-start">
            <div className="relative" ref={modelMenuRef}>
              <button
                type="button"
                onClick={() => {
                  if (busy || availableModels.length === 0) return;
                  setIsModelMenuOpen((prev) => !prev);
                }}
                disabled={busy || availableModels.length === 0}
                className="inline-flex max-w-[300px] items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:max-w-[420px] sm:text-sm"
                aria-haspopup="listbox"
                aria-expanded={isModelMenuOpen}
              >
                <span className="text-gray-500 dark:text-slate-400">
                  Model:
                </span>
                <span className="truncate font-medium text-gray-800 dark:text-slate-100">
                  {selectedModelLabel}
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-gray-500 transition-transform dark:text-slate-400 ${
                    isModelMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isModelMenuOpen && (
                <div className="absolute bottom-[calc(100%+8px)] left-0 z-40 w-[min(90vw,380px)] overflow-hidden rounded-md border border-gray-200 bg-white shadow-md dark:border-slate-700 dark:bg-slate-800">
                  <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-300">
                    Choose NVIDIA model
                  </div>
                  <ul
                    role="listbox"
                    className="model-menu-scrollbar max-h-56 overflow-y-auto p-1.5"
                  >
                    {availableModels.map((model) => {
                      const selected = model.id === selectedModel;
                      return (
                        <li key={model.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={selected}
                            onClick={() => {
                              onModelChange(model.id);
                              setIsModelMenuOpen(false);
                            }}
                            className={`w-full rounded-md px-3 py-2.5 text-left transition-colors ${
                              selected
                                ? "bg-gray-100 text-gray-900 dark:bg-slate-700 dark:text-slate-100"
                                : "text-gray-700 hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-700/50"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="truncate text-sm font-medium dark:text-inherit">
                                {model.label}
                              </span>
                              {selected && (
                                <Check className="h-4 w-4 shrink-0 text-gray-700 dark:text-slate-200" />
                              )}
                            </div>
                            <div className="mt-1 truncate text-[11px] text-gray-500 dark:text-slate-400">
                              {model.id}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-start justify-center gap-2 sm:gap-3">
            <div className="flex-1 min-w-0">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                disabled={busy || isStorageFull}
                placeholder={
                  isStorageFull ? "Memory full..." : "Ask me anything..."
                }
                rows={1}
                className={`w-full resize-none rounded-2xl border ${
                  isStorageFull
                    ? "bg-red-50/50 dark:bg-red-900/20 border-red-200 dark:border-red-900 cursor-not-allowed"
                    : "bg-gray-50/50 dark:bg-slate-800 border-gray-200 dark:border-slate-700"
                } px-4 py-3 text-sm sm:text-base dark:text-slate-100 dark:placeholder-slate-500 outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-slate-600 focus:border-gray-400 dark:focus:border-slate-500 focus:bg-white dark:focus:bg-slate-700 transition-all [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`}
                style={{ minHeight: "52px", maxHeight: "200px" }}
              />
            </div>
            {busy ? (
              <button
                type="button"
                onClick={onStop}
                className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-md bg-red-500 text-white transition-colors hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
              >
                <Square className="w-5 h-5" fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || isStorageFull}
                className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-md bg-gray-800 text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                <Send className="h-5 w-5" strokeWidth={2.2} />
              </button>
            )}
          </div>
          <div className="mt-1 flex items-center justify-center gap-1.5 text-center text-[10.5px] text-gray-400 opacity-80 dark:text-slate-500">
            <div className="flex items-center gap-1">
              <kbd className="rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 font-sans font-medium text-gray-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400">
                Enter
              </kbd>
              <span>to send</span>
            </div>
            <span className="text-gray-300 dark:text-slate-700">•</span>
            <div className="flex items-center gap-1">
              <kbd className="rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 font-sans font-medium text-gray-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400">
                Shift + Enter
              </kbd>
              <span>for new line</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
