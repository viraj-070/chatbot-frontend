import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

export default function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-3 sm:my-4 rounded-lg overflow-hidden border border-gray-700 bg-[#1e1e1e]">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-[#2d2d2d] px-3 sm:px-4 py-1.5 sm:py-2 border-b border-gray-700">
        <span className="text-xs font-medium text-gray-300 uppercase tracking-wide">
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium text-gray-300 bg-[#1e1e1e] hover:bg-[#252526] rounded transition-colors border border-gray-600"
        >
          {copied ? (
            <>
              <svg
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-green-400 hidden xs:inline">Copied!</span>
            </>
          ) : (
            <>
              <svg
                className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span className="hidden sm:inline">Copy code</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content - Scrollable */}
      <div className="overflow-x-auto">
        <SyntaxHighlighter
          language={language || "text"}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: "0.75rem",
            background: "#1e1e1e",
            fontSize: "0.75rem",
            lineHeight: "1.5",
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
