import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  ChevronDown,
  Copy,
  Check,
  ArrowRight,
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
    <div className="flex w-full h-full min-h-0 flex-col dark:bg-slate-950">
      <style>{`
        /* Custom orange scrollbar */
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #fb923c;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #f97316;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #f97316;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #fb923c;
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #fb923c transparent;
        }
        .dark .custom-scrollbar {
          scrollbar-color: #f97316 transparent;
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
          width: 8px;
        }
        .model-menu-scrollbar::-webkit-scrollbar-track {
          background: #fff7ed;
          border-radius: 9999px;
        }
        .model-menu-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #fdba74 0%, #fb923c 100%);
          border-radius: 9999px;
          border: 2px solid #fff7ed;
        }
        .model-menu-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #fb923c 0%, #f97316 100%);
        }
        .dark .model-menu-scrollbar::-webkit-scrollbar-track {
          background: #1e293b;
        }
        .dark .model-menu-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #f97316 0%, #ea580c 100%);
          border: 2px solid #1e293b;
        }
        .dark .model-menu-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #ea580c 0%, #c2410c 100%);
        }
        .model-menu-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #fb923c #fff7ed;
        }
        .dark .model-menu-scrollbar {
          scrollbar-color: #f97316 #1e293b;
        }
      `}</style>

      <div className="chat-container flex min-h-0 flex-1 flex-col w-full relative dark:bg-slate-950">
        {/* Top gradient for smooth fading - masked to make edges soft */}
        <div
          className="absolute top-0 left-0 right-0 h-5 bg-gradient-to-b from-orange-50 dark:from-slate-950 to-transparent z-10 pointer-events-none"
          style={{
            maskImage:
              "linear-gradient(to right, transparent, black 5%, black 95%, transparent)",
            WebkitMaskImage:
              "-webkit-linear-gradient(left, transparent, black 10%, black 90%, transparent)",
          }}
        />

        {/* Messages container */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto custom-scrollbar relative px-3 sm:px-4 py-6 dark:bg-slate-950"
        >
          <div className="w-full max-w-3xl mx-auto space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4 py-8">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-500 dark:from-orange-500 dark:to-orange-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm shadow-orange-200 dark:shadow-orange-900/50">
                  <ArrowRight
                    className="w-8 h-8 text-white ml-1"
                    strokeWidth={2.5}
                  />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100 mb-2">
                  Welcome to Chat
                </h2>
                <p className="text-gray-500 dark:text-slate-400 mb-8 max-w-md">
                  I'm your AI assistant. How can I help you today? Choose a
                  suggestion below or type your own question.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl text-left">
                  {[
                    "What features can you build using React and Tailwind?",
                    "How do I optimize a Vite React app?",
                    "Explain the use of React hooks with an example.",
                    "Help me write a Python script for data analysis.",
                  ].map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => onSend(suggestion)}
                      className="p-4 rounded-xl border border-orange-200/60 dark:border-slate-700 bg-white/80 dark:bg-slate-800/50 hover:bg-orange-50 dark:hover:bg-slate-700 hover:border-orange-300 dark:hover:border-slate-600 hover:shadow-sm transition-all text-sm text-gray-700 dark:text-slate-200 hover:text-orange-700 dark:hover:text-orange-400 group flex items-start justify-between"
                    >
                      <span className="pr-4">{suggestion}</span>
                      <ArrowRight className="w-5 h-5 text-gray-300 dark:text-slate-500 mt-0.5 group-hover:text-orange-400 dark:group-hover:text-orange-400 group-hover:translate-x-1 transition-transform shrink-0" />
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
                      <div className="rounded-2xl rounded-tr-md px-5 py-3.5 bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-sm text-sm sm:text-base whitespace-pre-wrap break-words w-fit">
                        {displayContent}
                      </div>
                      <span className="text-[10px] text-gray-400 mt-1.5 px-1 font-medium">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                  ) : (
                    <div className="w-full">
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
                          <div className="selectable-text prose prose-sm dark:prose-invert max-w-none text-gray-900 dark:text-slate-100 text-sm sm:text-base [&_p]:mb-3 [&_p]:leading-6 sm:[&_p]:leading-7 [&_h1]:text-xl sm:[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:mt-6 [&_h2]:text-lg sm:[&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:mt-5 [&_h3]:text-base sm:[&_h3]:text-lg [&_h3]:font-bold [&_h3]:mb-3 [&_h3]:mt-4 [&_ul]:list-disc [&_ul]:list-inside [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:list-inside [&_ol]:mb-3 [&_li]:mb-1 [&_li]:ml-2 [&_table]:min-w-full [&_table]:border-collapse [&_table]:text-xs sm:[&_table]:text-sm [&_th]:border [&_th]:border-gray-300 dark:[&_th]:border-slate-700 [&_th]:bg-gray-100 dark:[&_th]:bg-slate-800 [&_th]:px-2 sm:[&_th]:px-3 [&_th]:py-1 sm:[&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:whitespace-nowrap [&_th]:text-gray-900 dark:[&_th]:text-slate-100 [&_td]:border [&_td]:border-gray-300 dark:[&_td]:border-slate-700 [&_td]:px-2 sm:[&_td]:px-3 [&_td]:py-1 sm:[&_td]:py-2 [&_td]:whitespace-nowrap [&_a]:text-blue-600 dark:[&_a]:text-blue-400 [&_a:hover]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-orange-500 [&_blockquote]:pl-3 sm:[&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-600 dark:[&_blockquote]:text-slate-400 [&_p:last-child]:inline">
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
                                      className="bg-orange-100 dark:bg-slate-800 text-orange-800 dark:text-orange-300 px-1.5 sm:px-2 py-0.5 rounded text-xs sm:text-sm font-mono break-all"
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
                                className="p-1 rounded transition-colors"
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

        {/* Bottom gradient for smooth fading - masked to make edges soft */}
        <div
          className="absolute bottom-0 left-0 right-0 h-5 bg-gradient-to-b from-transparent to-orange-50 dark:to-slate-950 z-10 pointer-events-none"
          style={{
            maskImage:
              "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
            WebkitMaskImage:
              "-webkit-linear-gradient(left, transparent, black 10%, black 90%, transparent)",
          }}
        />

        {/* Scroll to bottom button - orange */}
        {showScrollButton && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-orange-500 dark:bg-orange-600 text-white w-10 h-10 rounded-full shadow-lg dark:shadow-orange-900/50 hover:bg-orange-600 dark:hover:bg-orange-700 transition-all flex items-center justify-center z-20"
          >
            <ArrowDown className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Input area */}
      <div className="w-full relative dark:bg-slate-950">
        {isStorageFull && (
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-max max-w-[90%] text-center bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 text-xs sm:text-sm font-medium px-3 py-1.5 rounded-full shadow-sm z-30">
            if memory full clear chat to continue conversation
          </div>
        )}
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-3xl mx-auto flex flex-col gap-2 p-3 sm:p-4 dark:bg-slate-950"
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
                className="group inline-flex max-w-[300px] sm:max-w-[420px] items-center gap-2 rounded-xl border border-orange-200/80 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-slate-200 shadow-sm transition-all hover:border-orange-300 dark:hover:border-slate-600 hover:bg-orange-50 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                aria-haspopup="listbox"
                aria-expanded={isModelMenuOpen}
              >
                <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-orange-400 dark:bg-orange-500"></span>
                <span className="text-gray-500 dark:text-slate-400 font-medium">
                  Model
                </span>
                <span className="truncate font-semibold text-gray-800 dark:text-slate-100">
                  {selectedModelLabel}
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-orange-500 dark:text-orange-400 transition-transform ${
                    isModelMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isModelMenuOpen && (
                <div className="absolute bottom-[calc(100%+10px)] left-0 z-40 w-[min(90vw,380px)] overflow-hidden rounded-2xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl dark:shadow-black/50 shadow-orange-100">
                  <div className="border-b border-orange-100 dark:border-slate-700 bg-orange-50/70 dark:bg-slate-700/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-400">
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
                            className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
                              selected
                                ? "bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300"
                                : "text-gray-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-700/50"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="truncate text-sm font-medium dark:text-inherit">
                                {model.label}
                              </span>
                              {selected && (
                                <Check className="h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" />
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

          <div className="flex gap-2 sm:gap-3 items-start justify-center">
            <div className="flex-1 min-w-0">
              {/* Added hide-scrollbar logic visually */}
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
                } px-4 py-3.5 text-sm sm:text-base dark:text-slate-100 dark:placeholder-slate-500 outline-none focus:ring-2 focus:ring-orange-400/50 dark:focus:ring-orange-600/50 focus:border-orange-400 dark:focus:border-orange-600 focus:bg-white dark:focus:bg-slate-700 shadow-sm transition-all [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`}
                style={{ minHeight: "52px", maxHeight: "200px" }}
              />
            </div>
            {busy ? (
              <button
                type="button"
                onClick={onStop}
                className="rounded-full bg-red-500 dark:bg-red-600 w-[52px] h-[52px] text-white transition-all hover:bg-red-600 dark:hover:bg-red-700 hover:scale-105 active:scale-95 flex items-center justify-center shrink-0 shadow-md dark:shadow-red-900/50"
              >
                <Square className="w-5 h-5" fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || isStorageFull}
                className="rounded-full bg-gradient-to-br from-orange-400 to-orange-500 dark:from-orange-500 dark:to-orange-600 w-[52px] h-[52px] text-white transition-all hover:from-orange-500 hover:to-orange-600 dark:hover:from-orange-600 dark:hover:to-orange-700 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center shrink-0 shadow-md dark:shadow-orange-900/50"
              >
                <Send className="w-5 h-5 ml-0.5" strokeWidth={2.5} />
              </button>
            )}
          </div>
          <div className="text-[10.5px] text-gray-400 dark:text-slate-500 text-center mt-2 flex items-center justify-center gap-1.5 opacity-80">
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100/80 dark:bg-slate-700/80 border border-gray-200/60 dark:border-slate-600 rounded-md text-gray-500 dark:text-slate-400 font-sans shadow-sm font-medium">
                Enter
              </kbd>
              <span>to send</span>
            </div>
            <span className="text-gray-300 dark:text-slate-700">•</span>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100/80 dark:bg-slate-700/80 border border-gray-200/60 dark:border-slate-600 rounded-md text-gray-500 dark:text-slate-400 font-sans shadow-sm font-medium">
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
