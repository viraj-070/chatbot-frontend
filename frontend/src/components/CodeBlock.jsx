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

  // theme change
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
    <div className="my-3 overflow-hidden rounded-md border border-gray-300 bg-white dark:border-slate-700 dark:bg-slate-900 sm:my-4">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-100 px-3 py-2 dark:border-slate-700 dark:bg-slate-800 sm:px-4">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-slate-300">
          {language || "code"}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onOpenSandbox?.(language || "", code)}
            className="flex items-center gap-1.5 rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 sm:gap-2 sm:px-3 sm:py-1.5"
          >
            <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Open in Sandbox</span>
            <span className="sm:hidden">Run</span>
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 sm:gap-2 sm:px-3 sm:py-1.5"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400 sm:h-4 sm:w-4" />
                <span className="hidden text-green-600 dark:text-green-400 xs:inline">
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

      {/* Code Content */}
      <div className="overflow-x-auto">
        <SyntaxHighlighter
          language={language || "text"}
          style={isDark ? vscDarkPlus : vs}
          customStyle={{
            margin: 0,
            padding: "0.9rem",
            background: "transparent",
            fontSize: "0.9rem",
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
