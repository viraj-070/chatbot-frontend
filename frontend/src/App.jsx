import { useEffect, useMemo, useRef, useState } from "react";
import { Code2, Moon, Search, Sun, Trash2 } from "lucide-react";
import Chat from "./components/Chat";
import SearchPanel from "./components/SearchPanel";
import SandboxPanel from "./components/SandboxPanel";
import {
  createProviderClient,
  DEFAULT_NVIDIA_MODEL_ID,
  DEFAULT_PROVIDER_ID,
} from "./lib/providerAdapter";
import { getMessageSearchResults } from "./lib/searchUtils";
import {
  getLatestSandboxSnippets,
  getPreferredSandboxTab,
  normalizeSandboxLanguage,
} from "./lib/sandboxUtils";

const THEME_STORAGE_KEY = "pibot_theme_v1";

const STORAGE_KEY = "pibot_chat_store_v1";
const LEGACY_STORAGE_KEY = "pibot_chat_history";
const MODEL_STORAGE_KEY = "pibot_selected_model_v1";
const PROVIDER_STORAGE_KEY = "pibot_selected_provider_v1";
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
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem(THEME_STORAGE_KEY) || "light";
  });
  const [selectedProvider] = useState(() => {
    return localStorage.getItem(PROVIDER_STORAGE_KEY) || DEFAULT_PROVIDER_ID;
  });
  const [selectedModel, setSelectedModel] = useState(() => {
    return localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_NVIDIA_MODEL_ID;
  });
  const [availableModels, setAvailableModels] = useState([]);
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchRoleFilter, setSearchRoleFilter] = useState("all");
  const [activeSearchResultIndex, setActiveSearchResultIndex] = useState(0);
  const [jumpTarget, setJumpTarget] = useState(null);
  const [sandboxPanelOpen, setSandboxPanelOpen] = useState(false);
  const [sandboxCode, setSandboxCode] = useState({
    html: "",
    css: "",
    js: "",
  });
  const [sandboxActiveTab, setSandboxActiveTab] = useState("html");
  const [sandboxAutoRun, setSandboxAutoRun] = useState(true);
  const [storageData, setStorageData] = useState(() => {
    const stats = getStoreStats(initialStore.chats, initialStore.activeChatId);
    return {
      percentage: stats.percentage,
      bytes: stats.bytes,
      isFull: stats.isFull,
    };
  });

  const abortControllerRef = useRef(null);
  const processedAssistantMessagesRef = useRef(new Set());
  const providerClient = useMemo(
    () =>
      createProviderClient({
        providerId: selectedProvider,
        apiBaseUrl: API_BASE_URL,
      }),
    [selectedProvider],
  );
  const activeChat = chats.find((chat) => chat.id === activeChatId) || chats[0];
  const activeMessages = useMemo(
    () => activeChat?.messages || [],
    [activeChat],
  );
  const searchResults = useMemo(
    () =>
      getMessageSearchResults(activeMessages, searchQuery, searchRoleFilter),
    [activeMessages, searchQuery, searchRoleFilter],
  );
  const matchedMessageIndexes = useMemo(
    () => [...new Set(searchResults.map((result) => result.messageIndex))],
    [searchResults],
  );

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      document.body.classList.remove("light");
      document.body.classList.add("dark");
    } else {
      root.classList.remove("dark");
      document.body.classList.add("light");
      document.body.classList.remove("dark");
    }
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(PROVIDER_STORAGE_KEY, selectedProvider);
  }, [selectedProvider]);

  useEffect(() => {
    localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      try {
        const models = await providerClient.listModels();
        if (cancelled) return;

        setAvailableModels(models);
        setSelectedModel((currentModel) => {
          if (models.some((model) => model.id === currentModel)) {
            return currentModel;
          }
          return models[0]?.id || DEFAULT_NVIDIA_MODEL_ID;
        });
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load models", error);
        setAvailableModels([]);
        setSelectedModel(DEFAULT_NVIDIA_MODEL_ID);
      }
    }

    loadModels();

    return () => {
      cancelled = true;
    };
  }, [providerClient]);

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

  useEffect(() => {
    function handleShortcuts(event) {
      const isSearchShortcut =
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "f";
      const isSandboxShortcut =
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "e";

      if (isSearchShortcut) {
        event.preventDefault();
        setSearchPanelOpen((prev) => {
          const next = !prev;
          if (!next) {
            setSearchQuery("");
            setSearchRoleFilter("all");
            setActiveSearchResultIndex(0);
            setJumpTarget(null);
          }
          return next;
        });
        return;
      }

      if (isSandboxShortcut) {
        event.preventDefault();
        setSandboxPanelOpen((prev) => !prev);
        return;
      }

      if (event.key === "Escape") {
        if (searchPanelOpen) {
          setSearchPanelOpen(false);
          setSearchQuery("");
          setSearchRoleFilter("all");
          setActiveSearchResultIndex(0);
          setJumpTarget(null);
        }
        if (sandboxPanelOpen) setSandboxPanelOpen(false);
      }
    }

    window.addEventListener("keydown", handleShortcuts);
    return () => window.removeEventListener("keydown", handleShortcuts);
  }, [sandboxPanelOpen, searchPanelOpen]);

  useEffect(() => {
    if (!searchResults.length) {
      setActiveSearchResultIndex(0);
      return;
    }

    if (activeSearchResultIndex >= searchResults.length) {
      setActiveSearchResultIndex(searchResults.length - 1);
    }
  }, [activeSearchResultIndex, searchResults]);

  useEffect(() => {
    setActiveSearchResultIndex(0);
  }, [activeChatId, searchQuery, searchRoleFilter]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setJumpTarget(null);
    }
  }, [searchQuery]);

  useEffect(() => {
    const lastIndex = activeMessages.length - 1;
    if (lastIndex < 0) return;

    const lastMessage = activeMessages[lastIndex];
    if (
      !lastMessage ||
      lastMessage.role !== "assistant" ||
      lastMessage.streaming
    ) {
      return;
    }

    const processingKey = `${activeChatId}:${lastIndex}:${lastMessage.timestamp || ""}:${String(lastMessage.content || "").length}`;
    if (processedAssistantMessagesRef.current.has(processingKey)) {
      return;
    }
    processedAssistantMessagesRef.current.add(processingKey);

    const { snippets, hasSnippet } = getLatestSandboxSnippets(
      lastMessage.content,
    );
    if (!hasSnippet) return;

    setSandboxCode((previousCode) => ({
      html: snippets.html || previousCode.html,
      css: snippets.css || previousCode.css,
      js: snippets.js || previousCode.js,
    }));
    setSandboxActiveTab(getPreferredSandboxTab(snippets));
  }, [activeChatId, activeMessages]);

  async function requestCompletion(
    chatMessages,
    signal,
    targetChatId,
    modelId,
  ) {
    const isKnownModel = availableModels.some((model) => model.id === modelId);
    const safeModelId = isKnownModel
      ? modelId
      : (availableModels[0]?.id ?? DEFAULT_NVIDIA_MODEL_ID);

    const content = await providerClient.streamMessage(
      chatMessages,
      safeModelId,
      signal,
      (accumulatedText) => {
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
      },
    );

    return content || "sorry, nothing came back";
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
        selectedModel,
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

    const existingEmptyChat = chats.find(
      (chat) => Array.isArray(chat.messages) && chat.messages.length === 0,
    );

    if (existingEmptyChat) {
      setActiveChatId(existingEmptyChat.id);
      setEditingChatId(null);
      setEditingTitle("");
      setSidebarOpen(false);
      return;
    }

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

  function handleModelChange(nextModelId) {
    if (busy) return;
    if (!availableModels.some((model) => model.id === nextModelId)) return;
    setSelectedModel(nextModelId);
  }

  function handleThemeToggle() {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }

  function clearSearchState() {
    setSearchQuery("");
    setSearchRoleFilter("all");
    setActiveSearchResultIndex(0);
    setJumpTarget(null);
  }

  function handleSearchPanelClose() {
    setSearchPanelOpen(false);
    clearSearchState();
  }

  function handleSearchPanelToggle() {
    if (searchPanelOpen) {
      handleSearchPanelClose();
      return;
    }

    setSearchPanelOpen(true);
  }

  function jumpToSearchResult(resultIndex) {
    if (!searchResults.length) return;

    const safeIndex = Math.max(
      0,
      Math.min(resultIndex, searchResults.length - 1),
    );
    const target = searchResults[safeIndex];
    if (!target) return;

    setActiveSearchResultIndex(safeIndex);
    setJumpTarget({
      messageIndex: target.messageIndex,
      requestId: Date.now() + Math.random(),
    });
  }

  function handleSearchNavigate(direction) {
    if (!searchResults.length) return;
    const nextIndex =
      (activeSearchResultIndex + direction + searchResults.length) %
      searchResults.length;
    jumpToSearchResult(nextIndex);
  }

  function handleOpenSandboxFromCode(language, code) {
    const normalizedLanguage = normalizeSandboxLanguage(language);
    if (!normalizedLanguage) return;

    setSandboxCode((previousCode) => ({
      ...previousCode,
      [normalizedLanguage]: code,
    }));
    setSandboxActiveTab(normalizedLanguage);
    setSandboxPanelOpen(true);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 text-gray-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed z-50 h-full w-72 transform border-r border-gray-200 bg-white p-4 transition-all duration-300 ease-in-out dark:border-slate-700 dark:bg-slate-900 md:relative md:z-auto ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="mb-4 flex items-center justify-between md:hidden">
          <span className="text-lg font-semibold text-gray-800 dark:text-slate-100">
            Chats
          </span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-slate-800"
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
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
            Chats
          </div>
          <button
            onClick={handleCreateChat}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
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
                    ? "border-gray-300 bg-gray-50 dark:border-slate-600 dark:bg-slate-800"
                    : "border-gray-200 bg-white hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
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
                      className="flex-1 rounded-md border border-orange-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-orange-300 dark:focus:ring-orange-500 dark:text-slate-100"
                    />
                  ) : (
                    <button
                      onClick={() => {
                        if (busy) return;
                        setActiveChatId(chat.id);
                        setSidebarOpen(false);
                      }}
                      disabled={busy}
                      className="flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      {chat.title}
                    </button>
                  )}

                  {!isEditing && (
                    <>
                      <button
                        onClick={() => handleStartRename(chat.id, chat.title)}
                        disabled={busy}
                        className="h-7 w-7 rounded-md text-gray-400 dark:text-slate-500 hover:bg-orange-50 dark:hover:bg-slate-700 hover:text-orange-600 dark:hover:text-orange-400 disabled:opacity-40"
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
                        className="h-7 w-7 rounded-md text-gray-400 dark:text-slate-500 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-40"
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
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-slate-800 md:hidden"
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

              <div className="flex items-center gap-3 text-xl font-semibold text-gray-800 dark:text-slate-100 sm:text-2xl min-w-0">
                Chat
                <div className="group relative flex items-center">
                  <div
                    className={`cursor-help rounded-md border px-2 py-1 text-xs font-medium ${
                      storageData.isFull
                        ? "border-red-300 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400"
                        : storageData.percentage > 80
                          ? "border-yellow-300 bg-yellow-100 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                          : "border-gray-300 bg-white text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {storageData.percentage.toFixed(2)}% Used
                  </div>

                  <div className="pointer-events-none invisible absolute left-0 top-full z-50 mt-2 w-72 rounded-md border border-gray-300 bg-white p-3 text-sm text-gray-700 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <div className="mb-2 flex items-center justify-between border-b border-gray-200 pb-2 dark:border-slate-700">
                      <h4 className="font-semibold text-gray-900 dark:text-slate-100">
                        Global Storage Usage
                      </h4>
                      <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-600 dark:bg-slate-700 dark:text-slate-300">
                        {(storageData.bytes / (1024 * 1024)).toFixed(2)} MB / 4
                        MB
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 dark:text-slate-400">
                          Saved Chats
                        </span>
                        <span className="font-medium text-gray-800 dark:text-slate-200">
                          {chats.length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 dark:text-slate-400">
                          Current Capacity
                        </span>
                        <span className="font-medium text-gray-800 dark:text-slate-200">
                          {storageData.percentage.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSandboxPanelOpen((prev) => !prev);
                }}
                className="rounded-lg p-2 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                title="Open code sandbox"
              >
                <Code2 className="h-5 w-5" />
              </button>
              <button
                onClick={handleSearchPanelToggle}
                className="rounded-lg p-2 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                title="Search messages"
              >
                <Search className="h-5 w-5" />
              </button>
              <button
                onClick={handleThemeToggle}
                className="rounded-lg p-2 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              >
                {theme === "light" ? (
                  <Moon className="h-5 w-5" />
                ) : (
                  <Sun className="h-5 w-5" />
                )}
              </button>
              <button
                onClick={handleClearChat}
                disabled={busy || activeMessages.length === 0}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-500 dark:text-slate-400 transition-colors hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            </div>
          </div>

          <div className="mt-3 flex min-h-0 w-full flex-1 overflow-hidden bg-transparent sm:mt-4">
            <Chat
              messages={activeMessages}
              onSend={handleSend}
              onStop={handleStop}
              availableModels={availableModels}
              selectedModel={selectedModel}
              onModelChange={handleModelChange}
              busy={busy}
              status={status}
              isStorageFull={storageData.isFull}
              searchQuery={searchQuery}
              matchedMessageIndexes={matchedMessageIndexes}
              activeSearchMessageIndex={
                searchResults[activeSearchResultIndex]?.messageIndex ?? null
              }
              jumpTarget={jumpTarget}
              onOpenSandboxFromCode={handleOpenSandboxFromCode}
            />
          </div>
        </div>
      </div>

      <SearchPanel
        isOpen={searchPanelOpen}
        query={searchQuery}
        roleFilter={searchRoleFilter}
        results={searchResults}
        activeResultIndex={activeSearchResultIndex}
        onQueryChange={setSearchQuery}
        onRoleFilterChange={setSearchRoleFilter}
        onResultClick={jumpToSearchResult}
        onNavigate={handleSearchNavigate}
        onClose={handleSearchPanelClose}
      />

      <SandboxPanel
        isOpen={sandboxPanelOpen}
        code={sandboxCode}
        activeTab={sandboxActiveTab}
        autoRun={sandboxAutoRun}
        onCodeChange={setSandboxCode}
        onActiveTabChange={setSandboxActiveTab}
        onAutoRunChange={setSandboxAutoRun}
        onClose={() => setSandboxPanelOpen(false)}
      />
    </div>
  );
}
