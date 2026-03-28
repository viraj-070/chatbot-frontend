import { useState } from "react"
import Chat from "./components/Chat"

const defaultMessages = [
  { 
    role: "assistant", 
    content: "hi! i'm pibot, your ai assistant. ask me anything" 
  }
]
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5188"

export default function App() {
  const [messages, setMessages] = useState(defaultMessages)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState("ready")

  async function requestCompletion(chatMessages) {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chatMessages })
    })
    
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}))
      const detail = errorPayload.detail ? `: ${errorPayload.detail}` : ""
      throw new Error((errorPayload.error ?? `request failed (${response.status})`) + detail)
    }
    
    const contentType = response.headers.get("content-type")
    
    // Handle old JSON format for backwards compatibility
    if (contentType?.includes("application/json")) {
      const data = await response.json()
      const message = data.message ?? ""
      setMessages((current) => {
        const copy = [...current]
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].role === "assistant" && copy[i].streaming) {
            copy[i].content = message
            delete copy[i].streaming
            break
          }
        }
        return copy
      })
      return message
    }
    
    // Handle streaming format
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let accumulatedText = ""
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      const chunk = decoder.decode(value)
      const lines = chunk.split("\n")
      
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6)
          if (data === "[DONE]") {
            return accumulatedText
          }
          try {
            const parsed = JSON.parse(data)
            if (parsed.content) {
              accumulatedText += parsed.content
              setMessages((current) => {
                const copy = [...current]
                for (let i = copy.length - 1; i >= 0; i--) {
                  if (copy[i].role === "assistant" && copy[i].streaming) {
                    copy[i].content = accumulatedText
                    break
                  }
                }
                return copy
              })
            }
          } catch (e) {
            console.log("Parse error for chunk:", e)
          }
        }
      }
    }
    
    return accumulatedText || "sorry, nothing came back"
  }

  async function handleSend(text) {
    if (busy) return
    setBusy(true)
    setStatus("thinking")
    const userMessage = { role: "user", content: text }
    const botMessage = { role: "assistant", content: "", streaming: true }
    const payload = [...messages, userMessage]
    setMessages((current) => [...current, userMessage, botMessage])
    try {
      await requestCompletion(payload)
      setMessages((current) => {
        const copy = [...current]
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].role === "assistant" && copy[i].streaming) {
            delete copy[i].streaming
            break
          }
        }
        return copy
      })
      setStatus("ready")
    } catch (error) {
      setStatus("failed to reach backend")
      setMessages((current) => {
        const copy = [...current]
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].role === "assistant" && copy[i].streaming) {
            copy[i].content = String(error.message || "i hit a snag reaching backend")
            delete copy[i].streaming
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
