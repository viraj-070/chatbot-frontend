const CODE_BLOCK_REGEX = /```([a-zA-Z0-9+_.#-]*)\n([\s\S]*?)```/g;

function stripThinkingSection(content) {
  if (typeof content !== "string") return "";
  const closeTagIndex = content.indexOf("</think>");
  if (closeTagIndex === -1) return content;
  return content.slice(closeTagIndex + "</think>".length);
}

function guessLanguageFromCode(code) {
  const trimmed = String(code || "").trim();
  if (!trimmed) return null;

  if (/<\/?[a-z][\s\S]*>/i.test(trimmed)) {
    return "html";
  }

  if (/\{[\s\S]*:[\s\S]*;[\s\S]*\}/.test(trimmed)) {
    return "css";
  }

  if (
    /(const|let|var|function|=>|document\.|window\.|console\.)/.test(trimmed)
  ) {
    return "js";
  }

  return null;
}

export function normalizeSandboxLanguage(rawLanguage) {
  const normalized = String(rawLanguage || "")
    .trim()
    .toLowerCase()
    .split(/\s|\{|\[/)[0];

  if (!normalized) return null;

  if (["html", "htm", "xml", "xhtml", "vue", "svelte"].includes(normalized)) {
    return "html";
  }

  if (["css", "scss", "sass", "less", "stylus"].includes(normalized)) {
    return "css";
  }

  if (
    [
      "js",
      "javascript",
      "mjs",
      "cjs",
      "jsx",
      "ts",
      "tsx",
      "typescript",
    ].includes(normalized)
  ) {
    return "js";
  }

  return null;
}

export function extractCodeBlocksFromMarkdown(markdown) {
  const source = stripThinkingSection(markdown);
  if (!source) return [];

  CODE_BLOCK_REGEX.lastIndex = 0;
  const blocks = [];

  let match = CODE_BLOCK_REGEX.exec(source);
  while (match) {
    const rawLanguage = match[1] || "";
    const rawCode = (match[2] || "").replace(/\n$/, "");
    const language =
      normalizeSandboxLanguage(rawLanguage) || guessLanguageFromCode(rawCode);

    if (language && rawCode.trim()) {
      blocks.push({
        language,
        rawLanguage,
        code: rawCode,
      });
    }

    match = CODE_BLOCK_REGEX.exec(source);
  }

  return blocks;
}

export function getLatestSandboxSnippets(markdown) {
  const blocks = extractCodeBlocksFromMarkdown(markdown);
  const snippets = {
    html: "",
    css: "",
    js: "",
  };

  for (const block of blocks) {
    snippets[block.language] = block.code;
  }

  return {
    blocks,
    snippets,
    hasSnippet: Boolean(snippets.html || snippets.css || snippets.js),
  };
}

function escapeInlineScript(value) {
  return String(value || "").replace(/<\/script/gi, "<\\/script");
}

export function getPreferredSandboxTab(snippets) {
  if (snippets.html) return "html";
  if (snippets.css) return "css";
  if (snippets.js) return "js";
  return "html";
}

export function buildSandboxSrcDoc({ html, css, js }) {
  const bodyContent =
    String(html || "").trim() ||
    `<main class="sandbox-empty"><h2>Sandbox Ready</h2><p>Paste or generate HTML, CSS, and JS to preview output.</p></main>`;

  const cssContent = String(css || "");
  const jsContent = escapeInlineScript(String(js || ""));

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https: http:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data: https: http:; connect-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none';" />
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
        background: #ffffff;
        color: #0f172a;
      }
      .sandbox-empty {
        margin: 1rem;
        padding: 1rem;
        border: 1px dashed #cbd5e1;
        border-radius: 0.75rem;
        color: #475569;
      }
      .sandbox-error {
        position: fixed;
        right: 12px;
        bottom: 12px;
        max-width: min(90vw, 480px);
        background: rgba(127, 29, 29, 0.95);
        color: #fecaca;
        border: 1px solid rgba(254, 202, 202, 0.4);
        border-radius: 10px;
        padding: 10px 12px;
        font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        white-space: pre-wrap;
        z-index: 2147483647;
      }
      ${cssContent}
    </style>
  </head>
  <body>
    ${bodyContent}
    <script>
      (function () {
        function renderSandboxError(message) {
          var existing = document.getElementById("__sandbox_error__");
          if (!existing) {
            existing = document.createElement("div");
            existing.id = "__sandbox_error__";
            existing.className = "sandbox-error";
            document.body.appendChild(existing);
          }
          existing.textContent = String(message || "Unknown sandbox error");
        }

        window.addEventListener("error", function (event) {
          renderSandboxError(event.message || "Runtime error");
        });

        window.addEventListener("unhandledrejection", function (event) {
          var reason = event && event.reason ? event.reason : "Unhandled promise rejection";
          renderSandboxError(reason && reason.message ? reason.message : reason);
        });
      })();
    </script>
    <script>
      ${jsContent}
    </script>
  </body>
</html>`;
}
