import { useState, useRef } from "react";
import Chat from "./components/Chat";

const defaultMessages = [
  {
    role: "assistant",
    content: "hi! i'm pibot, your ai assistant. ask me anything",
  },
];
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5188";

export default function App() {
  const [messages, setMessages] = useState(defaultMessages);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("ready");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const abortControllerRef = useRef(null);

  async function requestCompletion(chatMessages, signal) {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chatMessages }),
      signal,
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      const detail = errorPayload.detail ? `: ${errorPayload.detail}` : "";
      throw new Error(
        (errorPayload.error ?? `request failed (${response.status})`) + detail,
      );
    }

    const contentType = response.headers.get("content-type");

    // Handle old JSON format for backwards compatibility
    if (contentType?.includes("application/json")) {
      const data = await response.json();
      const message = data.message ?? "";
      setMessages((current) => {
        const copy = [...current];
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].role === "assistant" && copy[i].streaming) {
            copy[i].content = message;
            delete copy[i].streaming;
            break;
          }
        }
        return copy;
      });
      return message;
    }

    // Handle streaming format
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            return accumulatedText;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              accumulatedText += parsed.content;
              setMessages((current) => {
                const copy = [...current];
                for (let i = copy.length - 1; i >= 0; i--) {
                  if (copy[i].role === "assistant" && copy[i].streaming) {
                    copy[i].content = accumulatedText;
                    break;
                  }
                }
                return copy;
              });
            }
          } catch (e) {
            console.log("Parse error for chunk:", e);
          }
        }
      }
    }

    return accumulatedText || "sorry, nothing came back";
  }

  async function handleSend(text) {
    if (busy) return;
    setBusy(true);
    setStatus("thinking");
    
    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();
    
    const userMessage = { role: "user", content: text };
    const botMessage = { role: "assistant", content: "", streaming: true };
    const payload = [...messages, userMessage];
    setMessages((current) => [...current, userMessage, botMessage]);
    try {
      await requestCompletion(payload, abortControllerRef.current.signal);
      setMessages((current) => {
        const copy = [...current];
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].role === "assistant" && copy[i].streaming) {
            delete copy[i].streaming;
            break;
          }
        }
        return copy;
      });
      setStatus("ready");
    } catch (error) {
      // Handle abort separately
      if (error.name === "AbortError") {
        setMessages((current) => {
          const copy = [...current];
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].role === "assistant" && copy[i].streaming) {
              // Keep the partial content, just mark as stopped
              if (!copy[i].content) {
                copy[i].content = "(response stopped)";
              }
              delete copy[i].streaming;
              break;
            }
          }
          return copy;
        });
        setStatus("ready");
      } else {
        setStatus("failed to reach backend");
        setMessages((current) => {
          const copy = [...current];
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].role === "assistant" && copy[i].streaming) {
              copy[i].content = String(
                error.message || "i hit a snag reaching backend",
              );
              delete copy[i].streaming;
              break;
            }
          }
          return copy;
        });
        console.error(error);
      }
    } finally {
      abortControllerRef.current = null;
      setBusy(false);
    }
  }

  function handleStop() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white text-gray-900">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
        fixed md:relative z-50 md:z-auto
        w-64 h-full
        border-r border-gray-200 p-4
        bg-white
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}
      >
        <div className="flex items-center justify-between mb-4 md:hidden">
          <span className="text-lg font-semibold text-gray-800">Menu</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          sidebar
        </div>
      </aside>

      {/* Main content */}
      <div className="flex w-full min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4 md:p-6">
          {/* Header with mobile menu button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100 md:hidden"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <div className="text-xl sm:text-2xl font-semibold text-gray-800">
              pibot chat
            </div>
          </div>
          <div className="mt-3 sm:mt-4 flex min-h-0 flex-1 w-full rounded-2xl sm:rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <Chat
              messages={messages}
              onSend={handleSend}
              onStop={handleStop}
              busy={busy}
              status={status}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
