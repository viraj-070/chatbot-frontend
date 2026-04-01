import { useState, useRef, useEffect } from "react";
import Chat from "./components/Chat";

const STORAGE_KEY = "pibot_chat_history";
// Max capacity: 4MB
const MAX_STORAGE_BYTES = 4 * 1024 * 1024;

const getDefaultMessages = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error("Failed to load history from local storage", e);
  }
  return [];
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5188";

export default function App() {
  const [messages, setMessages] = useState(getDefaultMessages);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("ready");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [storageData, setStorageData] = useState({
    percentage: 0,
    bytes: 0,
    tokens: 0,
    isFull: false,
  });
  const abortControllerRef = useRef(null);

  useEffect(() => {
    try {
      let currentMessages = [...messages];
      let str = JSON.stringify(currentMessages);
      let bytes = new Blob([str]).size;

      // No auto-pruning. Handled gracefully by UI if it reaches the limit.

      localStorage.setItem(STORAGE_KEY, str);
      const percentage = Math.min(100, (bytes / MAX_STORAGE_BYTES) * 100);
      setStorageData({
        percentage: percentage.toFixed(2),
        bytes,
        tokens: Math.round(bytes / 4),
        isFull: bytes >= MAX_STORAGE_BYTES, // Will only be true if a single message exceeds 4MB
      });
    } catch (e) {
      console.error("Failed to save history to local storage", e);
      if (e.name === "QuotaExceededError") {
        const bytes = MAX_STORAGE_BYTES;
        setStorageData({
          percentage: 100,
          bytes,
          tokens: Math.round(bytes / 4),
          isFull: true,
        });
      }
    }
  }, [messages]);

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
    if (busy || storageData.isFull) return;
    setBusy(true);
    setStatus("thinking");

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    const userMessage = { role: "user", content: text, timestamp: new Date() };
    const botMessage = {
      role: "assistant",
      content: "",
      streaming: true,
      timestamp: new Date(),
    };
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

  function handleClearChat() {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
    setStorageData({ percentage: 0, bytes: 0, tokens: 0, isFull: false });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-orange-50 text-gray-900">
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
        border-r border-orange-200/50 p-4
        bg-orange-50/50
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
          {/* Header with mobile menu button and clear chat */}
          <div className="flex items-center justify-between">
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
              <div className="text-xl sm:text-2xl font-semibold text-gray-800 flex items-center gap-3">
                pibot chat
                <div className="relative group flex items-center">
                  {storageData.percentage >= 0 && (
                    <div
                      className={`text-xs px-2.5 py-1 rounded-full border shadow-sm cursor-help font-medium ${storageData.isFull ? "bg-red-50 text-red-700 border-red-200" : storageData.percentage > 80 ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
                    >
                      {storageData.percentage}% Used
                    </div>
                  )}
                  <div className="absolute top-full mt-2 left-0 w-64 p-4 bg-white border border-gray-200 rounded-xl shadow-lg text-sm text-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                    <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-100">
                      <h4 className="font-semibold text-gray-900 tracking-tight">
                        Storage Usage
                      </h4>
                      <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                        {(storageData.bytes / 1024).toFixed(1)} KB / 4 MB
                      </span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">Current Capacity</span>
                        <span className="font-medium text-gray-800">
                          {storageData.percentage}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Clear chat button */}
            <button
              onClick={handleClearChat}
              disabled={busy || messages.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              <span className="hidden sm:inline">Clear</span>
            </button>
          </div>
          <div className="mt-3 sm:mt-4 flex min-h-0 flex-1 w-full bg-transparent overflow-hidden">
            <Chat
              messages={messages}
              onSend={handleSend}
              onStop={handleStop}
              onClear={handleClearChat}
              busy={busy}
              status={status}
              isStorageFull={storageData.isFull}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
