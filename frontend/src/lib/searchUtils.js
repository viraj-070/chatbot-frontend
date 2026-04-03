export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makePreview(content, query, radius = 60) {
  const text = String(content || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  if (!query.trim()) return text.slice(0, radius * 2);

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const hitIndex = lowerText.indexOf(lowerQuery);

  if (hitIndex === -1) return text.slice(0, radius * 2);

  const start = Math.max(0, hitIndex - radius);
  const end = Math.min(text.length, hitIndex + query.length + radius);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";

  return `${prefix}${text.slice(start, end)}${suffix}`;
}

export function getMessageSearchResults(messages, query, roleFilter = "all") {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const safeQuery = escapeRegExp(trimmed);
  const regex = new RegExp(safeQuery, "gi");

  return messages
    .map((message, index) => {
      if (roleFilter !== "all" && message.role !== roleFilter) {
        return null;
      }

      const content = String(message.content || "");
      const matches = content.match(regex);
      if (!matches?.length) return null;

      return {
        messageIndex: index,
        role: message.role,
        matchCount: matches.length,
        preview: makePreview(content, trimmed),
        timestamp: message.timestamp || null,
      };
    })
    .filter(Boolean);
}
