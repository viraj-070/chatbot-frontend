import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { Play, RotateCcw, X } from "lucide-react";
import { buildSandboxSrcDoc } from "../lib/sandboxUtils";

const TAB_CONFIG = [
  { id: "html", label: "HTML", editorLanguage: "html" },
  { id: "css", label: "CSS", editorLanguage: "css" },
  { id: "js", label: "JavaScript", editorLanguage: "javascript" },
];

export default function SandboxPanel({
  isOpen,
  code,
  activeTab,
  autoRun,
  onCodeChange,
  onActiveTabChange,
  onAutoRunChange,
  onClose,
}) {
  const [isDark, setIsDark] = useState(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : false,
  );
  const [previewDoc, setPreviewDoc] = useState(() =>
    buildSandboxSrcDoc(code || {}),
  );

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isOpen || !autoRun) return;
    setPreviewDoc(buildSandboxSrcDoc(code || {}));
  }, [autoRun, code, isOpen]);

  if (!isOpen) return null;

  function handleRunPreview() {
    setPreviewDoc(buildSandboxSrcDoc(code || {}));
  }

  function handleReset() {
    const resetCode = { html: "", css: "", js: "" };
    onCodeChange(resetCode);
    setPreviewDoc(buildSandboxSrcDoc(resetCode));
    onActiveTabChange("html");
  }

  function handleEditorChange(value) {
    onCodeChange({
      ...code,
      [activeTab]: value || "",
    });
  }

  const activeTabConfig =
    TAB_CONFIG.find((tab) => tab.id === activeTab) || TAB_CONFIG[0];

  const panelContent = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-orange-50/95 backdrop-blur-sm dark:bg-slate-950/95">
      <div className="flex items-center justify-between border-b border-orange-100 bg-gradient-to-r from-orange-50 to-orange-100/60 px-3 py-2 dark:border-slate-700 dark:from-slate-800 dark:to-slate-800/70">
        <div className="flex items-center gap-2 text-sm font-semibold text-orange-700 dark:text-orange-300">
          Code Sandbox
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-gray-500 transition-colors hover:bg-white/70 hover:text-gray-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          aria-label="Close sandbox panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-lg border border-orange-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
            {TAB_CONFIG.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onActiveTabChange(tab.id)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  tab.id === activeTab
                    ? "bg-orange-500 text-white"
                    : "text-gray-600 hover:bg-orange-50 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <label className="inline-flex items-center gap-1.5 rounded-md border border-orange-200 bg-white px-2 py-1 text-[11px] text-gray-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <input
                type="checkbox"
                checked={autoRun}
                onChange={(event) => onAutoRunChange(event.target.checked)}
                className="h-3.5 w-3.5 accent-orange-500"
              />
              Auto run
            </label>
            <button
              type="button"
              onClick={handleRunPreview}
              className="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-white px-2 py-1 text-xs font-medium text-orange-700 transition-colors hover:bg-orange-50 dark:border-slate-700 dark:bg-slate-800 dark:text-orange-300 dark:hover:bg-slate-700"
            >
              <Play className="h-3.5 w-3.5" />
              Run
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-orange-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
          <div className="min-h-[260px] overflow-hidden rounded-xl border border-orange-200 dark:border-slate-700">
            <Editor
              height="100%"
              language={activeTabConfig.editorLanguage}
              value={code?.[activeTab] || ""}
              theme={isDark ? "vs-dark" : "light"}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                wordWrap: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
              onChange={handleEditorChange}
            />
          </div>

          <div className="flex min-h-[260px] flex-col overflow-hidden rounded-xl border border-orange-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-orange-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-orange-700 dark:border-slate-700 dark:text-orange-300">
              Output
            </div>
            <iframe
              title="Sandbox Preview"
              className="h-full w-full border-0 bg-white"
              sandbox="allow-scripts"
              referrerPolicy="no-referrer"
              srcDoc={previewDoc}
            />
          </div>
        </div>
      </div>
    </div>
  );

  return <div className="fixed inset-0 z-[70]">{panelContent}</div>;
}
