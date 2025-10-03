import { useState } from "react"
import "./style.css"

// Set popup dimensions
export const config = {
  matches: ["<all_urls>"]
}

function IndexPopup() {
  const [prompt, setPrompt] = useState("")
  const [response, setResponse] = useState("")
  const [loading, setLoading] = useState(false)

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
