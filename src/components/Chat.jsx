import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Chat({ messages, onSend, busy, status }) {
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
      `}</style>
      <div className="flex min-h-0 flex-1 flex-col w-full">
        <div className="flex-1 space-y-3 overflow-y-auto p-4 w-full">
          {messages.map((message, index) => {
            const mine = message.role === "user";
            const isThinking = message.content === "__thinking__";
            const hasThinking = hasThinkingTag(message.content);
            const displayContent = hasThinking
              ? extractResponse(message.content)
              : message.content;

            return (
              <div
                key={index}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[78%] rounded-2xl border px-4 py-3 ${
                    mine
                      ? "bg-orange-600 border-orange-600 text-white"
                      : "bg-gray-100 border-gray-200 text-gray-900"
                  }`}
                >
                  {isThinking ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">{status}</span>
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
                    <div className="prose prose-sm max-w-none [&_p]:mb-3 [&_p]:leading-6 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:mt-6 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:mt-5 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mb-3 [&_h3]:mt-4 [&_h4]:text-base [&_h4]:font-bold [&_h4]:mb-2 [&_h4]:mt-3 [&_h5]:font-bold [&_h5]:mb-2 [&_h5]:mt-2 [&_h6]:font-semibold [&_h6]:mb-2 [&_h6]:mt-2 [&_ul]:list-disc [&_ul]:list-inside [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:list-inside [&_ol]:mb-3 [&_li]:mb-1 [&_li]:ml-2 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-200 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-bold [&_td]:border [&_td]:border-gray-300 [&_td]:px-3 [&_td]:py-2 [&_code]:bg-gray-800 [&_code]:text-yellow-300 [&_code]:px-2 [&_code]:py-1 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-gray-800 [&_pre]:text-gray-100 [&_pre]:p-3 [&_pre]:rounded [&_pre]:overflow-x-auto [&_a]:text-blue-600 [&_a:hover]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-600">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {displayContent}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {busy && !messages.some((m) => m.content === "__thinking__") && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
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
                  <span className="text-gray-600">{status}</span>
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>
      <form
        onSubmit={handleSubmit}
        className="flex gap-2 border-t border-gray-200 p-4"
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={busy}
          placeholder="type something"
          className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-400"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          send
        </button>
      </form>
    </div>
  );
}
