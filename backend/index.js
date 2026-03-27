import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import OpenAI from "openai"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, ".env") })

const PORT = process.env.SERVER_PORT ?? 5188
const baseUrl = (process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1").replace(/\/$/, "")
const defaultModel = process.env.NVIDIA_MODEL ?? "moonshotai/kimi-k2-thinking"
const defaultMaxTokens = Number(process.env.NVIDIA_MAX_TOKENS ?? 16384)
const apiKey = process.env.NVIDIA_API_KEY ?? process.env.VITE_NVIDIA_API_KEY
const openai = new OpenAI({
  apiKey,
  baseURL: baseUrl
})

function cleanResponseText(value) {
  if (!value) return ""
  let text = String(value)
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "")
  if (/<\/think>/i.test(text)) {
    text = text.split(/<\/think>/i).pop() ?? text
  }
  text = text.replace(/<\/?think>/gi, "").trim()
  return text
}

const app = express()
app.use(cors())
app.use(express.json())

app.get("/api/health", (req, res) => {
  res.json({ ok: true, port: PORT })
})

app.post("/api/chat", async (req, res) => {
  console.log("POST /api/chat")
  if (!apiKey) {
    return res.status(500).json({ error: "missing NVIDIA_API_KEY" })
  }
  if (apiKey.includes("<<replace-with-real-key>>") || apiKey.includes("your-real-key-here")) {
    return res.status(500).json({ error: "set a real NVIDIA_API_KEY in backend/.env" })
  }
  const { messages, model } = req.body
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "messages must be an array" })
  }
  const modelId = model ?? defaultModel
  try {
    const completion = await openai.chat.completions.create({
      model: modelId,
      messages,
      temperature: 1,
      top_p: 0.9,
      max_tokens: defaultMaxTokens,
      stream: true
    })
    let text = ""
    for await (const chunk of completion) {
      const delta = chunk.choices?.[0]?.delta
      if (!delta) continue
      if (delta.content) {
        text += delta.content
      }
    }
    const finalText = cleanResponseText(text) || "no response text returned"
    return res.json({ message: finalText })
  } catch (error) {
    console.error("Nvidia request failed", error?.status, error?.message)
    const status = Number(error?.status) || 502
    const detail = error?.error?.message ?? error?.message ?? "failed to reach Nvidia"
    return res.status(status >= 400 ? status : 502).json({ error: `Nvidia request failed (${status})`, detail })
  }
})

app.listen(PORT, () => {
  console.log(`proxy listening on http://localhost:${PORT}`)
}).on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`port ${PORT} is already in use. update SERVER_PORT in backend/.env`)
    return
  }
  console.error(error)
})
