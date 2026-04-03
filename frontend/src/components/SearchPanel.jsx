import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Minus, X, GripHorizontal } from "lucide-react";
import { escapeRegExp } from "../lib/searchUtils";

const PANEL_WIDTH = 380;
const PANEL_HEIGHT = 480;
const MINIMIZED_PANEL_HEIGHT = 64;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

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
  isMinimized,
  position,
  query,
  roleFilter,
  results,
  activeResultIndex,
  onQueryChange,
  onRoleFilterChange,
  onResultClick,
  onNavigate,
  onMinimize,
  onClose,
  onPositionChange,
}) {
  const panelRef = useRef(null);
  const dragRef = useRef({
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    dragging: false,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 1024,
    height: typeof window !== "undefined" ? window.innerHeight : 768,
  }));

  useEffect(() => {
    function handleResize() {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const viewportWidth = viewport.width;
  const viewportHeight = viewport.height;
  const panelWidth = Math.min(PANEL_WIDTH, Math.round(viewportWidth * 0.92));
  const panelHeight = isMinimized ? MINIMIZED_PANEL_HEIGHT : PANEL_HEIGHT;
  const maxX = Math.max(12, viewportWidth - panelWidth - 12);
  const maxY = Math.max(12, viewportHeight - panelHeight - 12);

  const resolvedPosition = useMemo(() => {
    if (position) {
      return {
        x: clamp(position.x, 12, maxX),
        y: clamp(position.y, 12, maxY),
      };
    }

    return {
      x: maxX,
      y: clamp(108, 12, maxY),
    };
  }, [maxX, maxY, position]);

  if (!isOpen) return null;

  function handlePointerDown(event) {
    const isPrimaryButton = event.button === 0;
    if (!isPrimaryButton) return;

    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: resolvedPosition.x,
      originY: resolvedPosition.y,
      dragging: true,
    };

    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!dragRef.current.dragging) return;

    const deltaX = event.clientX - dragRef.current.startX;
    const deltaY = event.clientY - dragRef.current.startY;

    onPositionChange({
      x: clamp(dragRef.current.originX + deltaX, 12, maxX),
      y: clamp(dragRef.current.originY + deltaY, 12, maxY),
    });
  }

  function handlePointerUp(event) {
    if (!dragRef.current.dragging) return;
    dragRef.current.dragging = false;
    setIsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handlePointerCancel(event) {
    if (!dragRef.current.dragging) return;
    dragRef.current.dragging = false;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div
      ref={panelRef}
      className={`fixed z-[60] ${isDragging ? "select-none" : ""}`}
      style={{ left: resolvedPosition.x, top: resolvedPosition.y }}
    >
      <div className="w-[min(92vw,380px)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            className="flex cursor-move items-center gap-2 text-sm font-semibold text-gray-700 dark:text-slate-100"
          >
            <GripHorizontal className="h-4 w-4" />
            Message Search
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onMinimize}
              onPointerDown={(event) => event.stopPropagation()}
              className="rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              aria-label={
                isMinimized ? "Expand search panel" : "Minimize search panel"
              }
            >
              <Minus className="h-4 w-4" />
            </button>
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

        {isMinimized ? (
          <button
            type="button"
            onClick={onMinimize}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-gray-600 transition-colors hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <span className="truncate">
              {query.trim() ? `"${query}"` : "Search is minimized"}
            </span>
            <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-700 dark:bg-slate-700 dark:text-slate-200">
              {results.length} results
            </span>
          </button>
        ) : (
          <div className="space-y-3 p-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => onQueryChange(event.target.value)}
                  placeholder="Search in this chat..."
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-slate-400 dark:focus:ring-slate-600/40"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(event) => onRoleFilterChange(event.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs text-gray-700 outline-none focus:border-gray-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
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
                <div className="rounded-lg border border-dashed border-gray-300 px-3 py-5 text-center text-xs text-gray-500 dark:border-slate-600 dark:text-slate-400">
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
                      className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
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
        )}
      </div>
    </div>
  );
}
