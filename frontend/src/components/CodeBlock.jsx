import React, { useState, useEffect } from "react";
import { Copy, Check, Play } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { vs } from "react-syntax-highlighter/dist/esm/styles/prism";

export default function CodeBlock({ language, code, onOpenSandbox }) {
  const [copied, setCopied] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Listen to theme changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative my-3 sm:my-4 rounded-lg overflow-hidden border border-gray-700 dark:border-slate-700 bg-[#1e1e1e] dark:bg-[#0f172a]">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-[#2d2d2d] dark:bg-[#1e293b] px-3 sm:px-4 py-1.5 sm:py-2 border-b border-gray-700 dark:border-slate-700">
        <span className="text-xs font-medium text-gray-300 dark:text-slate-400 uppercase tracking-wide">
          {language || "code"}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onOpenSandbox?.(language || "", code)}
            className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium text-orange-300 bg-[#1e1e1e] dark:bg-[#0f172a] hover:bg-[#252526] dark:hover:bg-slate-800 rounded transition-colors border border-orange-500/40 dark:border-orange-500/30"
          >
            <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Open in Sandbox</span>
            <span className="sm:hidden">Run</span>
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium text-gray-300 dark:text-slate-400 bg-[#1e1e1e] dark:bg-[#0f172a] hover:bg-[#252526] dark:hover:bg-slate-800 rounded transition-colors border border-gray-600 dark:border-slate-700"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400 dark:text-green-500" />
                <span className="text-green-400 dark:text-green-500 hidden xs:inline">
                  Copied!
                </span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Copy code</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Content - Scrollable */}
      <div className="overflow-x-auto">
        <SyntaxHighlighter
          language={language || "text"}
          style={isDark ? vscDarkPlus : vs}
          customStyle={{
            margin: 0,
            padding: "0.75rem",
            background: isDark ? "#0f172a" : "#ffffff",
            fontSize: "inherit",
            lineHeight: "1.5",
            color: isDark ? "#e2e8f0" : "#1e293b",
          }}
          showLineNumbers={true}
          wrapLines={true}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
