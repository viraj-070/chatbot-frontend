import { useEffect, useMemo, useRef, useState } from "react";
import Chat from "./components/Chat";

const STORAGE_KEY = "pibot_chat_store_v1";
const LEGACY_STORAGE_KEY = "pibot_chat_history";
const MAX_STORAGE_BYTES = 4 * 1024 * 1024;
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5188";

function createChat(id, title) {
  const now = new Date().toISOString();
  return {
    id,
    title,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

function getNextDefaultChatName(chats) {
  let maxNumber = 0;
  for (const chat of chats) {
    const match = /^New Chat (\d+)$/.exec(chat.title || "");
    if (!match) continue;
    maxNumber = Math.max(maxNumber, Number(match[1]));
  }
  return `New Chat ${maxNumber + 1}`;
}

function makeChatTitleFromPrompt(text) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "New Chat";
  if (cleaned.length <= 42) return cleaned;
  const sliced = cleaned.slice(0, 42);
  const lastSpace = sliced.lastIndexOf(" ");
  const title = lastSpace > 20 ? sliced.slice(0, lastSpace) : sliced;
  return `${title.trim()}...`;
}

function isDefaultTitle(title) {
  return /^New Chat \d+$/.test(title || "");
}

function getStoreStats(chats, activeChatId) {
  const payload = {
    version: 1,
    activeChatId,
    chats,
  };
  const serialized = JSON.stringify(payload);
  const bytes = new Blob([serialized]).size;
  const percentage = Number(((bytes / MAX_STORAGE_BYTES) * 100).toFixed(2));
  return {
    serialized,
    bytes,
    percentage: Math.min(100, percentage),
    isFull: bytes >= MAX_STORAGE_BYTES,
  };
}

function getInitialStore() {
  try {
    const savedStore = localStorage.getItem(STORAGE_KEY);
    if (savedStore) {
      const parsed = JSON.parse(savedStore);
      if (Array.isArray(parsed?.chats) && parsed.chats.length > 0) {
        const activeChatId = parsed.chats.some(
          (chat) => chat.id === parsed.activeChatId,
        )
          ? parsed.activeChatId
          : parsed.chats[0].id;

        return {
          chats: parsed.chats,
          activeChatId,
        };
      }
    }

    const legacyMessages = [];
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const parsedLegacy = JSON.parse(legacy);
      if (Array.isArray(parsedLegacy)) {
        legacyMessages.push(...parsedLegacy);
      }
    }

    const initialChat = createChat("chat-1", "New Chat 1");
    initialChat.messages = legacyMessages;
    initialChat.updatedAt = new Date().toISOString();

    return {
      chats: [initialChat],
      activeChatId: initialChat.id,
    };
  } catch (error) {
    console.error("Failed to load chat history", error);
    const fallback = createChat("chat-1", "New Chat 1");
    return {
      chats: [fallback],
      activeChatId: fallback.id,
    };
  }
}

export default function App() {
  const initialStore = useMemo(() => getInitialStore(), []);
  const [chats, setChats] = useState(initialStore.chats);
  const [activeChatId, setActiveChatId] = useState(initialStore.activeChatId);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("ready");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingChatId, setEditingChatId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [storageData, setStorageData] = useState(() => {
    const stats = getStoreStats(initialStore.chats, initialStore.activeChatId);
    return {
      percentage: stats.percentage,
      bytes: stats.bytes,
      isFull: stats.isFull,
    };
  });

  const abortControllerRef = useRef(null);
  const activeChat = chats.find((chat) => chat.id === activeChatId) || chats[0];
  const activeMessages = activeChat?.messages || [];

  useEffect(() => {
    if (!chats.length) {
      const fallback = createChat("chat-1", "New Chat 1");
      setChats([fallback]);
      setActiveChatId(fallback.id);
      return;
    }

    if (!chats.some((chat) => chat.id === activeChatId)) {
      setActiveChatId(chats[0].id);
    }
  }, [activeChatId, chats]);

  useEffect(() => {
    try {
      const stats = getStoreStats(chats, activeChatId);
      localStorage.setItem(STORAGE_KEY, stats.serialized);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      setStorageData({
        percentage: stats.percentage,
        bytes: stats.bytes,
        isFull: stats.isFull,
      });
    } catch (error) {
      console.error("Failed to save chat history", error);
      if (error?.name === "QuotaExceededError") {
        setStorageData({
          percentage: 100,
          bytes: MAX_STORAGE_BYTES,
          isFull: true,
        });
      }
    }
  }, [activeChatId, chats]);

  async function requestCompletion(chatMessages, signal, targetChatId) {
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

    if (contentType?.includes("application/json")) {
      const data = await response.json();
      const message = data.message ?? "";

      setChats((currentChats) =>
        currentChats.map((chat) => {
          if (chat.id !== targetChatId) return chat;
          const nextMessages = [...chat.messages];
          for (let i = nextMessages.length - 1; i >= 0; i -= 1) {
            if (
              nextMessages[i].role === "assistant" &&
              nextMessages[i].streaming
            ) {
              nextMessages[i] = {
                ...nextMessages[i],
                content: message,
                streaming: false,
              };
              break;
            }
          }
          return {
            ...chat,
            messages: nextMessages,
            updatedAt: new Date().toISOString(),
          };
        }),
      );

      return message;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);

        if (data === "[DONE]") {
          return accumulatedText;
        }

        try {
          const parsed = JSON.parse(data);
          if (!parsed.content) continue;

          accumulatedText += parsed.content;

          setChats((currentChats) =>
            currentChats.map((chat) => {
              if (chat.id !== targetChatId) return chat;
              const nextMessages = [...chat.messages];
              for (let i = nextMessages.length - 1; i >= 0; i -= 1) {
                if (
                  nextMessages[i].role === "assistant" &&
                  nextMessages[i].streaming
                ) {
                  nextMessages[i] = {
                    ...nextMessages[i],
                    content: accumulatedText,
                  };
                  break;
                }
              }
              return {
                ...chat,
                messages: nextMessages,
                updatedAt: new Date().toISOString(),
              };
            }),
          );
        } catch (error) {
          console.log("Parse error for chunk:", error);
        }
      }
    }

    return accumulatedText || "sorry, nothing came back";
  }

  async function handleSend(text) {
    if (busy || storageData.isFull || !activeChat) return;

    const targetChatId = activeChat.id;
    const nowIso = new Date().toISOString();
    const userMessage = { role: "user", content: text, timestamp: nowIso };
    const botMessage = {
      role: "assistant",
      content: "",
      streaming: true,
      timestamp: nowIso,
    };

    setBusy(true);
    setStatus("thinking");
    abortControllerRef.current = new AbortController();

    setChats((currentChats) =>
      currentChats.map((chat) => {
        if (chat.id !== targetChatId) return chat;
        const nextTitle =
          chat.messages.length === 0 && isDefaultTitle(chat.title)
            ? makeChatTitleFromPrompt(text)
            : chat.title;
        return {
          ...chat,
          title: nextTitle,
          messages: [...chat.messages, userMessage, botMessage],
          updatedAt: nowIso,
        };
      }),
    );

    const payload = [...activeChat.messages, userMessage];

    try {
      await requestCompletion(
        payload,
        abortControllerRef.current.signal,
        targetChatId,
      );

      setChats((currentChats) =>
        currentChats.map((chat) => {
          if (chat.id !== targetChatId) return chat;
          const nextMessages = [...chat.messages];
          for (let i = nextMessages.length - 1; i >= 0; i -= 1) {
            if (
              nextMessages[i].role === "assistant" &&
              nextMessages[i].streaming
            ) {
              nextMessages[i] = {
                ...nextMessages[i],
                streaming: false,
              };
              break;
            }
          }
          return {
            ...chat,
            messages: nextMessages,
            updatedAt: new Date().toISOString(),
          };
        }),
      );

      setStatus("ready");
    } catch (error) {
      if (error?.name === "AbortError") {
        setChats((currentChats) =>
          currentChats.map((chat) => {
            if (chat.id !== targetChatId) return chat;
            const nextMessages = [...chat.messages];
            for (let i = nextMessages.length - 1; i >= 0; i -= 1) {
              if (
                nextMessages[i].role === "assistant" &&
                nextMessages[i].streaming
              ) {
                nextMessages[i] = {
                  ...nextMessages[i],
                  content: nextMessages[i].content || "(response stopped)",
                  streaming: false,
                };
                break;
              }
            }
            return {
              ...chat,
              messages: nextMessages,
              updatedAt: new Date().toISOString(),
            };
          }),
        );

        setStatus("ready");
      } else {
        setStatus("failed to reach backend");

        setChats((currentChats) =>
          currentChats.map((chat) => {
            if (chat.id !== targetChatId) return chat;
            const nextMessages = [...chat.messages];
            for (let i = nextMessages.length - 1; i >= 0; i -= 1) {
              if (
                nextMessages[i].role === "assistant" &&
                nextMessages[i].streaming
              ) {
                nextMessages[i] = {
                  ...nextMessages[i],
                  content: String(
                    error.message || "i hit a snag reaching backend",
                  ),
                  streaming: false,
                };
                break;
              }
            }
            return {
              ...chat,
              messages: nextMessages,
              updatedAt: new Date().toISOString(),
            };
          }),
        );

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

  function handleCreateChat() {
    if (busy) return;
    const id = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const title = getNextDefaultChatName(chats);
    const newChat = createChat(id, title);
    setChats((current) => [newChat, ...current]);
    setActiveChatId(newChat.id);
    setEditingChatId(null);
    setEditingTitle("");
  }

  function handleDeleteChat(chatId) {
    if (busy) return;

    setChats((currentChats) => {
      if (currentChats.length <= 1) {
        const resetChat = createChat("chat-1", "New Chat 1");
        setActiveChatId(resetChat.id);
        return [resetChat];
      }

      const remaining = currentChats.filter((chat) => chat.id !== chatId);
      if (chatId === activeChatId) {
        const id = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const fresh = createChat(id, getNextDefaultChatName(remaining));
        setActiveChatId(fresh.id);
        return [fresh, ...remaining];
      }

      return remaining;
    });

    if (editingChatId === chatId) {
      setEditingChatId(null);
      setEditingTitle("");
    }
  }

  function handleStartRename(chatId, currentTitle) {
    if (busy) return;
    setEditingChatId(chatId);
    setEditingTitle(currentTitle);
  }

  function handleSaveRename(chatId) {
    const trimmed = editingTitle.trim().slice(0, 60);
    if (!trimmed) {
      setEditingChatId(null);
      setEditingTitle("");
      return;
    }

    setChats((currentChats) =>
      currentChats.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              title: trimmed,
              updatedAt: new Date().toISOString(),
            }
          : chat,
      ),
    );

    setEditingChatId(null);
    setEditingTitle("");
  }

  function handleClearChat() {
    if (!activeChat) return;

    setChats((currentChats) =>
      currentChats.map((chat) =>
        chat.id === activeChat.id
          ? {
              ...chat,
              messages: [],
              updatedAt: new Date().toISOString(),
            }
          : chat,
      ),
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-orange-50 text-gray-900">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed z-50 h-full w-72 transform border-r border-orange-200/50 bg-orange-50/80 p-4 transition-transform duration-300 ease-in-out md:relative md:z-auto ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="mb-4 flex items-center justify-between md:hidden">
          <span className="text-lg font-semibold text-gray-800">Chats</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <svg
              className="h-5 w-5"
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

        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Chats
          </div>
          <button
            onClick={handleCreateChat}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-white px-2 py-1 text-xs font-medium text-orange-700 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M10 4a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V5a1 1 0 011-1z" />
            </svg>
            New
          </button>
        </div>

        <div className="h-[calc(100%-84px)] space-y-2 overflow-y-auto pr-1">
          {chats.map((chat) => {
            const isActive = chat.id === activeChatId;
            const isEditing = editingChatId === chat.id;

            return (
              <div
                key={chat.id}
                className={`group rounded-xl border transition-colors ${
                  isActive
                    ? "border-orange-300 bg-white shadow-sm"
                    : "border-orange-100 bg-white/70 hover:bg-white"
                }`}
              >
                <div className="flex items-center gap-1 p-2">
                  {isEditing ? (
                    <input
                      value={editingTitle}
                      onChange={(event) => setEditingTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") handleSaveRename(chat.id);
                        if (event.key === "Escape") {
                          setEditingChatId(null);
                          setEditingTitle("");
                        }
                      }}
                      onBlur={() => handleSaveRename(chat.id)}
                      maxLength={60}
                      autoFocus
                      className="flex-1 rounded-md border border-orange-200 bg-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                    />
                  ) : (
                    <button
                      onClick={() => {
                        if (busy) return;
                        setActiveChatId(chat.id);
                        setSidebarOpen(false);
                      }}
                      disabled={busy}
                      className="flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-orange-50 disabled:cursor-not-allowed"
                    >
                      {chat.title}
                    </button>
                  )}

                  {!isEditing && (
                    <>
                      <button
                        onClick={() => handleStartRename(chat.id, chat.title)}
                        disabled={busy}
                        className="h-7 w-7 rounded-md text-gray-400 hover:bg-orange-50 hover:text-orange-600 disabled:opacity-40"
                        aria-label="Rename chat"
                      >
                        <svg
                          className="mx-auto h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteChat(chat.id)}
                        disabled={busy}
                        className="h-7 w-7 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        aria-label="Delete chat"
                      >
                        <svg
                          className="mx-auto h-3.5 w-3.5"
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
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <div className="flex min-h-0 w-full flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-lg p-2 hover:bg-gray-100 md:hidden"
              >
                <svg
                  className="h-6 w-6"
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

              <div className="flex items-center gap-3 text-xl font-semibold text-gray-800 sm:text-2xl">
                pibot chat
                <div className="group relative flex items-center">
                  <div
                    className={`cursor-help rounded-full border px-2.5 py-1 text-xs font-medium shadow-sm ${
                      storageData.isFull
                        ? "border-red-200 bg-red-50 text-red-700"
                        : storageData.percentage > 80
                          ? "border-orange-200 bg-orange-50 text-orange-700"
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {storageData.percentage.toFixed(2)}% Used
                  </div>

                  <div className="pointer-events-none invisible absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700 opacity-0 shadow-lg transition-all duration-200 group-hover:visible group-hover:opacity-100">
                    <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-3">
                      <h4 className="font-semibold tracking-tight text-gray-900">
                        Global Storage Usage
                      </h4>
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-500">
                        {(storageData.bytes / (1024 * 1024)).toFixed(2)} MB / 4
                        MB
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Saved Chats</span>
                        <span className="font-medium text-gray-800">
                          {chats.length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Current Capacity</span>
                        <span className="font-medium text-gray-800">
                          {storageData.percentage.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleClearChat}
              disabled={busy || activeMessages.length === 0}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg
                className="h-4 w-4"
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

          <div className="mt-3 flex min-h-0 w-full flex-1 overflow-hidden bg-transparent sm:mt-4">
            <Chat
              messages={activeMessages}
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
