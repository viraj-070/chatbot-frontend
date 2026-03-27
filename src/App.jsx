import { useState } from "react"
import Chat from "./components/Chat"

const defaultMessages = [{ role: "assistant", content: "hi im pibot. type and i will answer." }]
const defaultModel = "moonshotai/kimi-k2-thinking"

export default function App() {
  const [messages, setMessages] = useState(defaultMessages)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState("ready")
  const modelId = import.meta.env.VITE_NVIDIA_MODEL ?? defaultModel

  async function requestCompletion(chatMessages) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chatMessages, model: modelId })
    })
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}))
      const detail = errorPayload.detail ? `: ${errorPayload.detail}` : ""
      throw new Error((errorPayload.error ?? `request failed (${response.status})`) + detail)
    }
    const data = await response.json()
    return data.message ?? ""
  }

  async function handleSend(text) {
    if (busy) return
    setBusy(true)
    setStatus("thinking")
    const userMessage = { role: "user", content: text }
    const botMessage = { role: "assistant", content: "__thinking__" }
    const payload = [...messages, userMessage]
    setMessages((current) => [...current, userMessage, botMessage])
    try {
      const answer = await requestCompletion(payload)
      setMessages((current) => {
        const copy = [...current]
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].role === "assistant" && copy[i].content === "__thinking__") {
            copy[i].content = answer || "sorry, nothing came back"
            break
          }
        }
        return copy
      })
      setStatus("ready")
    } catch (error) {
      setStatus("failed to reach Nvidia")
      setMessages((current) => {
        const copy = [...current]
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].role === "assistant" && copy[i].content === "__thinking__") {
            copy[i].content = String(error.message || "i hit a snag reaching Nvidia")
            break
          }
        }
        return copy
      })
      console.error(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white text-gray-900">
      <aside className="w-64 border-r border-gray-200 p-4">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">sidebar</div>
      </aside>

      <div className="flex w-full min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col p-6">
          <div className="text-2xl font-semibold text-gray-800">pibot chat</div>
          <div className="mt-4 flex min-h-0 flex-1 w-full rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <Chat messages={messages} onSend={handleSend} busy={busy} status={status} />
          </div>
        </div>
      </div>
    </div>
  )
}
