import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  forwardRef,
} from "react";
import { Copy, Check, ArrowDown, Square, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Virtuoso } from "react-virtuoso";
import CodeBlock from "./CodeBlock";

const SPACER_COLLAPSE_MS = 760;
const SPACER_COLLAPSE_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const BASE_BOTTOM_GAP = 40;

const VirtualScroller = forwardRef(function VirtualScroller(props, ref) {
  const { className = "", ...rest } = props;

  return (
    <div
      ref={ref}
      {...rest}
      className={`chat-virtual-scroller custom-scrollbar overflow-x-hidden px-3 pb-4 pt-0 sm:px-4 dark:bg-slate-950 ${className}`.trim()}
    />
  );
});

const VirtualList = forwardRef(function VirtualList(props, ref) {
  const { className = "", ...rest } = props;

  return (
    <div
      ref={ref}
      {...rest}
      className={`mx-auto w-full max-w-3xl min-w-0 ${className}`.trim()}
    />
  );
});

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
  const [flashMessageIndex, setFlashMessageIndex] = useState(null);
  const [streamingSpacerHeight, setStreamingSpacerHeight] = useState(0);
  const [isSpacerMode, setIsSpacerMode] = useState(false);
  const virtuosoRef = useRef(null);
  const textareaRef = useRef(null);
  const pinPromptOnNextStreamRef = useRef(false);
  const spacerCollapseTimerRef = useRef(null);

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

  const scrollToBottom = useCallback(
    (behavior = "smooth") => {
      if (!messages.length) return;

      virtuosoRef.current?.scrollToIndex({
        index: messages.length - 1,
        align: "end",
        behavior,
      });
    },
    [messages.length],
  );

  function sendPrompt(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed || busy || isStorageFull) return;

    pinPromptOnNextStreamRef.current = true;
    onSend(trimmed);
  }

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || busy || isStorageFull) return;
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }
    sendPrompt(trimmed);
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

  const matchedMessageIndexSet = useMemo(
    () => new Set(matchedMessageIndexes || []),
    [matchedMessageIndexes],
  );

  useEffect(() => {
    if (!messages.length) {
      setShowScrollButton(false);
    }
  }, [messages.length]);

  useEffect(() => {
    return () => {
      if (spacerCollapseTimerRef.current) {
        window.clearTimeout(spacerCollapseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!jumpTarget || typeof jumpTarget.messageIndex !== "number") return;
    if (!messages.length) return;

    const targetIndex = Math.max(
      0,
      Math.min(jumpTarget.messageIndex, messages.length - 1),
    );

    virtuosoRef.current?.scrollToIndex({
      index: targetIndex,
      align: "center",
      behavior: "smooth",
    });

    setFlashMessageIndex(targetIndex);
    const timer = window.setTimeout(() => {
      setFlashMessageIndex((current) =>
        current === targetIndex ? null : current,
      );
    }, 1300);

    return () => window.clearTimeout(timer);
  }, [jumpTarget, messages.length]);

  useEffect(() => {
    if (!messages.length) {
      if (spacerCollapseTimerRef.current) {
        window.clearTimeout(spacerCollapseTimerRef.current);
        spacerCollapseTimerRef.current = null;
      }
      setStreamingSpacerHeight(0);
      setIsSpacerMode(false);
      pinPromptOnNextStreamRef.current = false;
      return;
    }

    const lastMessage = messages[messages.length - 1];
    const previousMessage = messages[messages.length - 2];
    const isLastAssistantStreaming =
      lastMessage?.role === "assistant" && Boolean(lastMessage?.streaming);

    if (
      pinPromptOnNextStreamRef.current &&
      isLastAssistantStreaming &&
      previousMessage?.role === "user"
    ) {
      const promptIndex = messages.length - 2;
      const scrollerElement =
        typeof document !== "undefined"
          ? document.querySelector(".chat-virtual-scroller")
          : null;
      const fallbackHeight =
        typeof window !== "undefined"
          ? Math.round(window.innerHeight * 0.7)
          : 600;
      const viewportHeight = scrollerElement?.clientHeight || fallbackHeight;
      const dynamicSpacer = Math.max(viewportHeight + 180, 520);

      if (spacerCollapseTimerRef.current) {
        window.clearTimeout(spacerCollapseTimerRef.current);
        spacerCollapseTimerRef.current = null;
      }

      setIsSpacerMode(true);
      setStreamingSpacerHeight(dynamicSpacer);

      requestAnimationFrame(() => {
        virtuosoRef.current?.scrollToIndex({
          index: promptIndex,
          align: "start",
          behavior: "auto",
        });

        window.setTimeout(() => {
          virtuosoRef.current?.scrollToIndex({
            index: promptIndex,
            align: "start",
            behavior: "auto",
          });
        }, 90);
      });

      pinPromptOnNextStreamRef.current = false;
      return;
    }

    if (isLastAssistantStreaming && spacerCollapseTimerRef.current) {
      window.clearTimeout(spacerCollapseTimerRef.current);
      spacerCollapseTimerRef.current = null;
    }

    if (
      !isLastAssistantStreaming &&
      isSpacerMode &&
      streamingSpacerHeight !== 0
    ) {
      setStreamingSpacerHeight(0);

      if (spacerCollapseTimerRef.current) {
        window.clearTimeout(spacerCollapseTimerRef.current);
      }

      spacerCollapseTimerRef.current = window.setTimeout(() => {
        setIsSpacerMode(false);
        spacerCollapseTimerRef.current = null;
      }, SPACER_COLLAPSE_MS + 40);
    }
  }, [messages, streamingSpacerHeight, isSpacerMode]);

  function renderMessageItem(message, index) {
    const mine = message.role === "user";
    const isStreaming = message.streaming;
    const hasThinking = hasThinkingTag(message.content);
    const isMatched =
      Boolean(searchQuery?.trim()) && matchedMessageIndexSet.has(index);
    const isActiveMatch = activeSearchMessageIndex === index;
    const isJumpFlash = flashMessageIndex === index;
    const displayContent = hasThinking
      ? extractResponse(message.content)
      : message.content;

    if (!mine && !isStreaming && !displayContent) {
      return <div className="h-0" />;
    }

    return (
      <div
        data-message-index={index}
        className={`search-message-anchor flex max-w-full rounded-2xl px-1 py-1 transition-colors ${
          mine ? "justify-end" : "justify-start"
        } ${isActiveMatch ? "search-match-active" : isMatched ? "search-match" : ""} ${
          isJumpFlash ? "search-jump-flash" : ""
        }`}
      >
        {mine ? (
          <div className="flex max-w-[85%] flex-col items-end sm:max-w-[75%]">
            <div className="w-fit whitespace-pre-wrap break-words rounded-lg bg-orange-500 px-4 py-2.5 text-sm text-white sm:text-base">
              {displayContent}
            </div>
            <span className="mt-1.5 px-1 text-[10px] font-medium text-gray-400">
              {formatTime(message.timestamp)}
            </span>
          </div>
        ) : (
          <div className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
            {isStreaming && !displayContent ? (
              <div className="flex items-center gap-2 py-2">
                <span className="text-xs text-gray-500 dark:text-slate-400 sm:text-sm">
                  {status}
                </span>
                <div className="flex gap-1">
                  <div className="h-1.5 w-1.5 animate-thinking rounded-full bg-orange-400" />
                  <div
                    className="h-1.5 w-1.5 animate-thinking rounded-full bg-orange-400"
                    style={{ animationDelay: "0.2s" }}
                  />
                  <div
                    className="h-1.5 w-1.5 animate-thinking rounded-full bg-orange-400"
                    style={{ animationDelay: "0.4s" }}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="selectable-text prose prose-sm max-w-none text-sm text-gray-800 dark:prose-invert dark:text-slate-100 [&_h1]:mb-3 [&_h1]:mt-5 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:mb-2 [&_h4]:mt-4 [&_h4]:text-base [&_h4]:font-semibold [&_h5]:mb-2 [&_h5]:mt-3 [&_h5]:text-sm [&_h5]:font-semibold [&_h6]:mb-2 [&_h6]:mt-3 [&_h6]:text-sm [&_h6]:font-medium [&_p]:mb-3 [&_p]:leading-7 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1 [&_table]:min-w-full [&_table]:border-collapse [&_table]:text-sm [&_th]:border [&_th]:border-gray-300 dark:[&_th]:border-slate-700 [&_th]:bg-gray-100 dark:[&_th]:bg-slate-800 [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-gray-300 dark:[&_td]:border-slate-700 [&_td]:px-2 [&_td]:py-1 [&_blockquote]:mb-3 [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 dark:[&_blockquote]:border-slate-600 [&_blockquote]:pl-3 [&_blockquote]:italic">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table({ children, ...props }) {
                        return (
                          <div className="-mx-1 my-3 overflow-x-auto px-1">
                            <table {...props}>{children}</table>
                          </div>
                        );
                      },
                      code({ inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || "");
                        const language = match ? match[1] : "";
                        const codeContent = String(children).replace(/\n$/, "");

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
                  <span className="streaming-cursor" />
                )}
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 dark:text-slate-500">
                    {formatTime(message.timestamp)}
                  </span>
                  {!isStreaming && displayContent && (
                    <button
                      onClick={() => copyToClipboard(displayContent, index)}
                      className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    >
                      {copiedIndex === index ? (
                        <Check className="h-3.5 w-3.5 text-green-500 dark:text-green-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-orange-400 hover:text-orange-600 dark:text-orange-500 dark:hover:text-orange-400" />
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
  }

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
        .chat-container .selectable-text button,
        .chat-container .selectable-text button *,
        .chat-container .selectable-text [role="button"],
        .chat-container .selectable-text [role="button"] *,
        .chat-container .selectable-text a,
        .chat-container .selectable-text a * {
          cursor: pointer;
        }
        .chat-container .selectable-text button:disabled,
        .chat-container .selectable-text button:disabled *,
        .chat-container .selectable-text [role="button"][aria-disabled="true"] {
          cursor: not-allowed;
        }
        .chat-container button {
          cursor: pointer;
        }
        .chat-container textarea {
          cursor: text;
        }

      `}</style>

      <div className="chat-container flex min-h-0 w-full flex-1 flex-col dark:bg-slate-950">
        <div className="relative flex-1 dark:bg-slate-950">
          {messages.length === 0 ? (
            <div className="custom-scrollbar h-full overflow-y-auto px-3 py-4 sm:px-4 dark:bg-slate-950">
              <div className="mx-auto w-full max-w-3xl space-y-4">
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
                        onClick={() => sendPrompt(suggestion)}
                        className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <Virtuoso
              ref={virtuosoRef}
              className="h-full"
              data={messages}
              components={{
                Scroller: VirtualScroller,
                List: VirtualList,
                Footer: () => (
                  <div
                    aria-hidden="true"
                    style={{
                      height: `${BASE_BOTTOM_GAP + streamingSpacerHeight}px`,
                      transition: `height ${SPACER_COLLAPSE_MS}ms ${SPACER_COLLAPSE_EASING}`,
                    }}
                  />
                ),
              }}
              atBottomStateChange={(isAtBottom) => {
                setShowScrollButton(!isAtBottom);
              }}
              followOutput={(isAtBottom) => {
                if (isSpacerMode) return false;
                return isAtBottom ? "smooth" : false;
              }}
              itemContent={(index, message) =>
                renderMessageItem(message, index)
              }
            />
          )}

          {/* Scroll to bottom button */}
          {showScrollButton && messages.length > 0 && (
            <button
              type="button"
              onClick={() => scrollToBottom("smooth")}
              className="absolute bottom-4 right-4 z-20 flex h-9 w-9 items-center justify-center rounded-md bg-gray-800 text-white transition-colors hover:bg-gray-700 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              <ArrowDown className="h-4 w-4" />
            </button>
          )}
        </div>
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
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-slate-300 sm:text-sm">
              <span>Model:</span>
              <select
                value={selectedModel}
                onChange={(event) => onModelChange(event.target.value)}
                disabled={busy || availableModels.length === 0}
                className="max-w-[300px] rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 outline-none focus:border-gray-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-slate-500 sm:max-w-[420px] sm:text-sm"
              >
                {availableModels.length === 0 ? (
                  <option value={selectedModel}>No models available</option>
                ) : (
                  availableModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))
                )}
              </select>
            </label>
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
          <div className="mt-1 text-center text-[11px] text-gray-500 dark:text-slate-400">
            Enter to send. Shift + Enter for new line.
          </div>
        </form>
      </div>
    </div>
  );
}
