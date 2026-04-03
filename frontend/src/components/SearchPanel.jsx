import { Search, X } from "lucide-react";
import { escapeRegExp } from "../lib/searchUtils";

function formatTime(date) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function highlightPreview(text, query) {
  if (!query.trim()) return text;

  const safe = escapeRegExp(query.trim());
  const regex = new RegExp(`(${safe})`, "gi");
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;
    const isMatch = part.toLowerCase() === query.trim().toLowerCase();
    if (!isMatch) {
      return <span key={`plain-${index}`}>{part}</span>;
    }

    return (
      <mark
        key={`match-${index}`}
        className="rounded bg-yellow-200 px-0.5 text-yellow-900 dark:bg-yellow-500/30 dark:text-yellow-100"
      >
        {part}
      </mark>
    );
  });
}

export default function SearchPanel({
  isOpen,
  query,
  roleFilter,
  results,
  activeResultIndex,
  onQueryChange,
  onRoleFilterChange,
  onResultClick,
  onNavigate,
  onClose,
}) {
  if (!isOpen) return null;

  return (
    <div className="absolute right-4 top-20 z-[60] w-[min(92vw,380px)]">
      <div className="overflow-hidden rounded-md border border-gray-300 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
          <div className="text-sm font-semibold text-gray-700 dark:text-slate-100">
            Message Search
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onClose}
              onPointerDown={(event) => event.stopPropagation()}
              className="rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              aria-label="Close search panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-3 p-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Search in this chat..."
                className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 outline-none focus:border-gray-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-slate-400"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(event) => onRoleFilterChange(event.target.value)}
              className="rounded-md border border-gray-300 bg-white px-2 py-2 text-xs text-gray-700 outline-none focus:border-gray-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All</option>
              <option value="user">User</option>
              <option value="assistant">Assistant</option>
            </select>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
            <span>{results.length} result(s)</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onNavigate(-1)}
                disabled={results.length === 0}
                className="rounded-md border border-gray-300 px-2 py-1 font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => onNavigate(1)}
                disabled={results.length === 0}
                className="rounded-md border border-gray-300 px-2 py-1 font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Next
              </button>
            </div>
          </div>

          <div className="search-panel-scrollbar max-h-72 overflow-y-auto space-y-2 pr-1">
            {results.length === 0 ? (
              <div className="rounded-md border border-dashed border-gray-300 px-3 py-5 text-center text-xs text-gray-500 dark:border-slate-600 dark:text-slate-400">
                No matches yet.
              </div>
            ) : (
              results.map((result, index) => {
                const isActive = index === activeResultIndex;
                return (
                  <button
                    key={`${result.messageIndex}-${index}`}
                    type="button"
                    onClick={() => onResultClick(index)}
                    className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                      isActive
                        ? "border-gray-400 bg-gray-100 dark:border-slate-500 dark:bg-slate-700/70"
                        : "border-gray-200 bg-white hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                      <span className="rounded-full bg-gray-200 px-2 py-0.5 font-semibold uppercase text-gray-700 dark:bg-slate-700 dark:text-slate-200">
                        {result.role}
                      </span>
                      <span className="text-gray-500 dark:text-slate-400">
                        {result.matchCount} hit
                        {result.matchCount > 1 ? "s" : ""}
                        {result.timestamp
                          ? ` • ${formatTime(result.timestamp)}`
                          : ""}
                      </span>
                    </div>
                    <div className="line-clamp-3 text-xs leading-5 text-gray-700 dark:text-slate-200">
                      {highlightPreview(result.preview, query)}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
