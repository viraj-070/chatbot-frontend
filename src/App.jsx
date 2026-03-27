import { useEffect, useRef, useState } from "react"

export default function App() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "hi im pibot. type and i will answer." }
  ])
  const [inp, setInp] = useState("")
  const [busy, setBusy] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    if (!endRef.current) return
    endRef.current.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, busy])
  
  async function send(e) {
    e.preventDefault()
    if (busy) return
    const t = inp.trim()
    if (!t) return

    setInp("")
    setBusy(true)

    const userObj = { role: "user", content: t }
    const botObj = { role: "assistant", content: "" }

    setMessages((m) => {
      m.push(userObj)
      m.push(botObj)
      return [...m]
    })

    const dummy = "hello how can i help you today?"
    try {
      await new Promise((r) => setTimeout(r, 550))
      setMessages((m) => {
        for (let i = m.length - 1; i >= 0; i--) {
          if (m[i]?.role === "assistant" && m[i]?.content === "") {
            m[i].content = dummy
            break
          }
        }
        return [...m]
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-screen flex bg-white text-gray-900">
      <aside className="w-64 border-r border-gray-200 p-4 flex flex-col">
        <div className="font-semibold text-lg">Project</div>
      </aside>

      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-auto p-4">
          {messages.map((m, i) => {
            const mine = m.role === "user"
            return (
              <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"} mb-3`}>
                <div
                  className={`max-w-[78%] whitespace-pre-wrap rounded-xl px-4 py-2 text-sm border ${
                    mine ? "bg-orange-600 border-orange-600 text-white" : "bg-gray-100 border-gray-200 text-gray-900"
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">{m.content}</div>
                </div>
              </div>
            )
          })}
          <div ref={endRef} />
        </div>

        <form onSubmit={send} className="p-4 border-t border-gray-200 flex gap-2 items-center">
          <input
            value={inp}
            onChange={(e) => setInp(e.target.value)}
            disabled={busy}
            placeholder="type.."
            className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-orange-200"
          />
          <button
            type="submit"
            disabled={busy}
            className="bg-orange-600 hover:bg-orange-500 disabled:opacity-60 disabled:cursor-not-allowed rounded-md px-4 py-2 text-sm font-semibold text-white"
          >
            send
          </button>
        </form>
      </div>
    </div>
  )
}
