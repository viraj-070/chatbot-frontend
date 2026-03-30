import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlock from "./CodeBlock";

export default function Chat({ messages, onSend, onStop, busy, status }) {
  const [input, setInput] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    if (!endRef.current) return;
    endRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || busy) return;
    setInput("");
    onSend(trimmed);
  }

  function extractResponse(content) {
    const match = content.match(/<\/think>\s*(.*)/s);
    return match ? match[1].trim() : content;
  }

  function hasThinkingTag(content) {
    return content.includes("<think>") || content.includes("</think>");
  }

  return (
    <div className="flex w-full h-full min-h-0 flex-col">
      <style>{`
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
        .streaming-text {
          background: linear-gradient(90deg, 
            rgba(0,0,0,0.3) 0%, 
            rgba(0,0,0,0.15) 50%, 
            rgba(0,0,0,0) 100%
          );
          padding: 2px 4px;
          border-radius: 2px;
        }
      `}</style>
      <div className="flex min-h-0 flex-1 flex-col w-full">
        <div className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4 w-full">
          {messages.map((message, index) => {
            const mine = message.role === "user";
            const isStreaming = message.streaming;
            const hasThinking = hasThinkingTag(message.content);
            const displayContent = hasThinking
              ? extractResponse(message.content)
              : message.content;

            // Don't render empty non-streaming bot messages
            if (!mine && !isStreaming && !displayContent) return null;

            return (
              <div
                key={index}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                {mine ? (
                  <div className="max-w-[90%] sm:max-w-[78%] rounded-2xl border px-3 sm:px-4 py-2 sm:py-3 bg-orange-600 border-orange-600 text-white text-sm sm:text-base break-words">
                    {displayContent}
                  </div>
                ) : (
                  <div className="max-w-[95%] sm:max-w-[85%] w-full">
                    {isStreaming && !displayContent ? (
                      <div className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-3">
                        <span className="text-xs sm:text-sm text-gray-600">
                          {status}
                        </span>
                        <div className="flex gap-1">
                          <div className="w-2 h-2 rounded-full bg-gray-400 animate-thinking"></div>
                          <div
                            className="w-2 h-2 rounded-full bg-gray-400 animate-thinking"
                            style={{ animationDelay: "0.2s" }}
                          ></div>
                          <div
                            className="w-2 h-2 rounded-full bg-gray-400 animate-thinking"
                            style={{ animationDelay: "0.4s" }}
                          ></div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="prose prose-sm max-w-none text-gray-900 text-sm sm:text-base [&_p]:mb-3 [&_p]:leading-6 sm:[&_p]:leading-7 [&_h1]:text-xl sm:[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:mt-6 [&_h2]:text-lg sm:[&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:mt-5 [&_h3]:text-base sm:[&_h3]:text-lg [&_h3]:font-bold [&_h3]:mb-3 [&_h3]:mt-4 [&_ul]:list-disc [&_ul]:list-inside [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:list-inside [&_ol]:mb-3 [&_li]:mb-1 [&_li]:ml-2 [&_table]:min-w-full [&_table]:border-collapse [&_table]:text-xs sm:[&_table]:text-sm [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-100 [&_th]:px-2 sm:[&_th]:px-3 [&_th]:py-1 sm:[&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:whitespace-nowrap [&_td]:border [&_td]:border-gray-300 [&_td]:px-2 sm:[&_td]:px-3 [&_td]:py-1 sm:[&_td]:py-2 [&_td]:whitespace-nowrap [&_a]:text-blue-600 [&_a:hover]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-orange-500 [&_blockquote]:pl-3 sm:[&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-600 [&_p:last-child]:inline">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              table({ node, children, ...props }) {
                                return (
                                  <div className="overflow-x-auto my-3 -mx-1 px-1">
                                    <table {...props}>{children}</table>
                                  </div>
                                );
                              },
                              code({
                                node,
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
                                  />
                                ) : (
                                  <code
                                    className="bg-orange-100 text-orange-800 px-1.5 sm:px-2 py-0.5 rounded text-xs sm:text-sm font-mono break-all"
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
      <form
        onSubmit={handleSubmit}
        className="flex gap-2 border-t border-gray-200 p-3 sm:p-4"
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={busy}
          placeholder="type something"
          className="flex-1 min-w-0 rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-400"
        />
        {busy ? (
          <button
            type="button"
            onClick={onStop}
            className="rounded-lg bg-red-600 px-3 sm:px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-red-700 whitespace-nowrap flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
            <span className="hidden sm:inline">stop</span>
          </button>
        ) : (
          <button
            type="submit"
            className="rounded-lg bg-orange-600 px-3 sm:px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-orange-700 whitespace-nowrap"
          >
            send
          </button>
        )}
      </form>
    </div>
  );
}
