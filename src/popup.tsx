import { useState, useEffect } from "react"
import "./style.css"

// Set popup dimensions
export const config = {
  matches: ["<all_urls>"]
}


interface PromptAPIStatus {
  available: 'readily' | 'downloading' | 'no' | 'downloaded'
  downloading: boolean
  downloadProgress: number
}

function IndexPopup() {
  const [prompt, setPrompt] = useState("")
  const [response, setResponse] = useState("")
  const [loading, setLoading] = useState(false)
  const [promptAPIStatus, setPromptAPIStatus] = useState<PromptAPIStatus>({
    available: 'no',
    downloading: false,
    downloadProgress: 0
  })
  const [session, setSession] = useState<any | null>(null)
  const [useStreaming, setUseStreaming] = useState(true)

  // Check Prompt API availability and initialize session
  useEffect(() => {
    const initPromptAPI = async () => {
      try {
        const availability = await window.LanguageModel.availability()
        console.log('[Popup] LanguageModel availability:', availability)

        // 'available' or undefined means the model is already downloaded and ready to use
        if (availability === 'available' || availability === undefined) {
          console.log('[Popup] Prompt API is available and model is ready.')
          setPromptAPIStatus({ available: 'downloaded', downloading: false, downloadProgress: 100 })
          const newSession = await window.LanguageModel.create({
            expectedInputs: [
              {
                type: "text",
                languages: ["en"]
              }
            ],
            expectedOutputs: [
              {
                type: "text",
                languages: ["en"]
              }
            ],
            systemInstruction: `
You are a helpful AI assistant built for a Chrome AI hackathon.
The user will ask questions or request help in English.
Always respond clearly, concisely, and in English.
Focus on practical, developer-friendly solutions and examples.
            `
          })
          setSession(newSession)
          return
        }

        console.log(session)

        // 'no' means the API is not supported in this browser
        if (availability === 'no') {
          setPromptAPIStatus({ available: 'no', downloading: false, downloadProgress: 0 })
          return
        }

        // 'readily' means it supports Chrome AI but doesn't have enough space to download
        if (availability === 'readily') {
          setPromptAPIStatus({ available: 'readily', downloading: false, downloadProgress: 0 })
          return
        }

        // 'downloading' means the model is currently being downloaded
        if (availability === 'downloading') {
          setPromptAPIStatus({ available: 'downloading', downloading: true, downloadProgress: 0 })
          // Try to create session to track download progress
          const newSession = await window.LanguageModel.create({
            expectedInputs: [
              {
                type: "text",
                languages: ["en"]
              }
            ],
            expectedOutputs: [
              {
                type: "text",
                languages: ["en"]
              }
            ],
            systemInstruction: `
You are a helpful AI assistant built for a Chrome AI hackathon.
The user will ask questions or request help in English.
Always respond clearly, concisely, and in English.
Focus on practical, developer-friendly solutions and examples.
            `,
            monitor(m) {
              m.addEventListener('downloadprogress', (e: any) => {
                const progress = Math.round((e.loaded || 0) * 100)
                console.log('[Popup] Download progress:', progress, '%')
                setPromptAPIStatus({
                  available: 'downloading',
                  downloading: progress < 100,
                  downloadProgress: progress
                })
              })
            }
          })
          setSession(newSession)
          setPromptAPIStatus({ available: 'downloaded', downloading: false, downloadProgress: 100 })
          return
        }
      } catch (error) {
        console.error('[Popup] Error initializing Prompt API:', error)
        setPromptAPIStatus({ available: 'no', downloading: false, downloadProgress: 0 })
      }
    }

    initPromptAPI()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return

    setLoading(true)
    setResponse("") // Clear previous response 

    try {
      // Check if session is available
      if (!session) {
        setResponse("Chrome Prompt API is not available. Please make sure you're using Chrome Canary with AI features enabled.")
        return
      }

      if (useStreaming) {
        // Use streaming API
        const stream = session.promptStreaming(prompt)

        for await (const chunk of stream) {
          setResponse(prev => prev + chunk)
        }
      } else {
        // Use non-streaming API
        const result = await session.prompt(prompt)
        setResponse(result)
      }
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

        {/* Prompt API Status */}
        {(promptAPIStatus.downloading || promptAPIStatus.available === 'downloading') && (
          <div className="download-status">
            <p>Downloading Gemini Nano model... {promptAPIStatus.downloadProgress}%</p>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${promptAPIStatus.downloadProgress}%` }}
              />
            </div>
          </div>
        )}

        {promptAPIStatus.available === 'no' && (
          <div className="error-message">
            Chrome Prompt API is not available. Please use Chrome Canary 128+ with AI features enabled.
          </div>
        )}

        {promptAPIStatus.available === 'readily' && (
          <div className="error-message">
            Chrome AI is supported but there's not enough disk space to download the model. Please free up some space.
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="prompt-form">
        <div className="streaming-toggle">
          <label className="toggle-container">
            <input
              type="checkbox"
              checked={useStreaming}
              onChange={(e) => setUseStreaming(e.target.checked)}
            />
            <span className="toggle-label">Enable Streaming Response</span>
          </label>
        </div>

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
          disabled={loading || !prompt.trim() || !session}
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

// TypeScript declarations for Chrome Prompt API
declare global {
  interface Window {
    LanguageModel?: {
      availability: () => Promise<'available' | 'readily' | 'downloading' | 'no' | undefined>
      params: () => Promise<{
        defaultTopK: number
        maxTopK: number
        defaultTemperature: number
        maxTemperature: number
      }>
      create: (options?: {
        topK?: number
        temperature?: number
        signal?: AbortSignal
        expectedInputs?: Array<{
          type: string
          languages: string[]
        }>
        expectedOutputs?: Array<{
          type: string
          languages: string[]
        }>
        systemInstruction?: string
        initialPrompts?: Array<{
          role: 'system' | 'user' | 'assistant'
          content: string
        }>
        monitor?: (monitor: {
          addEventListener: (event: 'downloadprogress', listener: (e: { loaded: number }) => void) => void
        }) => void
      }) => Promise<{
        prompt: (text: string, options?: { signal?: AbortSignal }) => Promise<string>
        promptStreaming: (text: string, options?: { signal?: AbortSignal }) => ReadableStream<string>
        destroy: () => void
        clone: (options?: { signal?: AbortSignal }) => Promise<any>
      }>
    }
  }
}
