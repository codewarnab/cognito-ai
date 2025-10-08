import { useState, useEffect } from "react"
import "./style.css"

// Set popup dimensions
export const config = {
  matches: ["<all_urls>"]
}

interface Status {
  paused: boolean
  modelReady: boolean
  error: boolean
}

function IndexPopup() {
  const [prompt, setPrompt] = useState("")
  const [response, setResponse] = useState("")
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<Status | null>(null)
  const [openError, setOpenError] = useState(false)

  // Read status from storage with timeout
  useEffect(() => {
    const withTimeout = (p: Promise<any>, ms = 150) => Promise.race([
      p, new Promise((res) => setTimeout(() => res(undefined), ms))
    ])

      ; (async () => {
        try {
          const st = await withTimeout(chrome.storage.local.get(["paused", "modelVersion", "modelReady"]))
          const paused = Boolean(st?.paused)
          const modelReady = Boolean(st?.modelReady) || Boolean(st?.modelVersion)
          setStatus({ paused, modelReady, error: false })
        } catch {
          setStatus({ paused: false, modelReady: false, error: true })
        }
      })()
  }, [])

  const openHistory = async () => {
    const url = chrome.runtime.getURL("tabs/history.html")
    try {
      const win = window.open(url, "_blank")
      if (!win) throw new Error("popup-blocked")
      setOpenError(false)
    } catch (_) {
      try {
        await chrome.tabs.create({ url })
        setOpenError(false)
      } catch {
        setOpenError(true)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return

    setLoading(true)
    try {
      // Check if Chrome AI API is available
      if (!window.ai || !window.ai.languageModel) {
        setResponse("Chrome AI is not available. Please make sure you're using Chrome Canary with AI features enabled.")
        return
      }

      const session = await window.ai.languageModel.create()
      const result = await session.prompt(prompt)
      setResponse(result)
    } catch (error) {
      setResponse(`Error: ${error.message || 'Failed to get AI response'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="popup-container">
      <div className="popup-header">
        <h1>🤖 Chrome AI Assistant</h1>
        <p className="subtitle">Powered by on-device AI</p>

        {/* History Search CTA and Status */}
        <div className="history-cta">
          <button
            onClick={openHistory}
            className="history-button"
            aria-label="Open History Search page"
          >
            🔍 Open History Search
          </button>

          {status && (
            <div className="status-container">
              <span className={`status-pill ${status.modelReady ? 'status-ok' : 'status-warn'}`}>
                {status.error ? "Unknown" : status.modelReady ? "Model ready" : "Model downloading"}
              </span>
              {status.paused && (
                <span className="status-pill status-paused">
                  Paused
                </span>
              )}
            </div>
          )}

          {openError && (
            <div className="error-message">
              Couldn't open History Search. <a href="#" onClick={(e) => { e.preventDefault(); openHistory(); }}>Try again</a>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="prompt-form">
        <textarea
          className="prompt-input"
          placeholder="Ask me anything..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
        />
        <button
          type="submit"
          className="submit-button"
          disabled={loading || !prompt.trim()}
        >
          {loading ? "Thinking..." : "Send"}
        </button>
      </form>

      {response && (
        <div className="response-container">
          <h3>Response:</h3>
          <div className="response-text">{response}</div>
        </div>
      )}
    </div>
  )
}

export default IndexPopup

// TypeScript declarations for Chrome AI
declare global {
  interface Window {
    ai?: {
      languageModel: {
        create: () => Promise<{
          prompt: (text: string) => Promise<string>
        }>
      }
    }
  }
}
