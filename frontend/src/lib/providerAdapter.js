const DEFAULT_HEADERS = { "Content-Type": "application/json" };

export const DEFAULT_PROVIDER_ID = "nvidia";

export const PREDEFINED_NVIDIA_MODELS = [
  {
    id: "microsoft/phi-3-mini-128k-instruct",
    label: "Phi-3 Mini 128K Instruct",
  },
  {
    id: "microsoft/phi-3-small-128k-instruct",
    label: "Phi-3 Small 128K Instruct",
  },
  {
    id: "microsoft/phi-3-medium-128k-instruct",
    label: "Phi-3 Medium 128K Instruct",
  },
  {
    id: "microsoft/phi-3-medium-4k-instruct",
    label: "Phi-3 Medium 4K Instruct",
  },
  {
    id: "microsoft/phi-3-small-8k-instruct",
    label: "Phi-3 Small 8K Instruct",
  },
  {
    id: "mistralai/mistral-medium-3-instruct",
    label: "Mistral Medium 3 Instruct",
  },
  {
    id: "qwen/qwen3-coder-480b-a35b-instruct",
    label: "Qwen3 Coder 480B A35B Instruct",
  },
  {
    id: "bytedance/seed-oss-36b-instruct",
    label: "Seed OSS 36B Instruct",
  },
  {
    id: "moonshotai/kimi-k2-thinking",
    label: "Kimi K2 Thinking",
  },
  {
    id: "thudm/chatglm3-6b",
    label: "ChatGLM3 6B",
  },
];

export const DEFAULT_NVIDIA_MODEL_ID = PREDEFINED_NVIDIA_MODELS[0].id;

function buildErrorMessage(response, payload) {
  const detail = payload?.detail ? `: ${payload.detail}` : "";
  return (payload?.error ?? `request failed (${response.status})`) + detail;
}

async function readResponseText(response) {
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(buildErrorMessage(response, errorPayload));
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await response.json();
    return data.message ?? "";
  }

  const reader = response.body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder();
  let accumulatedText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") return accumulatedText;

      try {
        const parsed = JSON.parse(data);
        if (parsed.content) accumulatedText += parsed.content;
      } catch {
        // Ignore malformed partial chunks.
      }
    }
  }

  return accumulatedText;
}

async function readStreamingResponse(response, onChunk) {
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(buildErrorMessage(response, errorPayload));
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await response.json();
    const message = data.message ?? "";
    onChunk(message);
    return message;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    onChunk("");
    return "";
  }

  const decoder = new TextDecoder();
  let accumulatedText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

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
        onChunk(accumulatedText);
      } catch {
        // Ignore malformed partial chunks.
      }
    }
  }

  return accumulatedText;
}

async function postChatRequest(apiBaseUrl, messages, model, signal) {
  return fetch(`${apiBaseUrl}/api/chat`, {
    method: "POST",
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({ messages, model }),
    signal,
  });
}

function createNvidiaAdapter(apiBaseUrl) {
  return {
    async sendMessage(messages, model, signal) {
      const response = await postChatRequest(
        apiBaseUrl,
        messages,
        model,
        signal,
      );
      return readResponseText(response);
    },
    async streamMessage(messages, model, signal, onChunk) {
      const response = await postChatRequest(
        apiBaseUrl,
        messages,
        model,
        signal,
      );
      return readStreamingResponse(response, onChunk);
    },
    async listModels() {
      return PREDEFINED_NVIDIA_MODELS;
    },
  };
}

export function createProviderClient({
  providerId = DEFAULT_PROVIDER_ID,
  apiBaseUrl,
}) {
  if (providerId === DEFAULT_PROVIDER_ID) {
    return createNvidiaAdapter(apiBaseUrl);
  }

  throw new Error(`Unsupported provider: ${providerId}`);
}
