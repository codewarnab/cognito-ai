import { useState, useRef, useEffect } from "react"
import { CopilotChatWindow } from "./components/CopilotChatWindow"
import { AudioLinesIcon, type AudioLinesIconHandle } from "./components/ActivityIcon"
import { AnimatePresence, motion } from 'framer-motion'
import "./styles/copilot.css"

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  text?: string
}

function SidePanel() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [pendingMessageId, setPendingMessageId] = useState<string | null>(null)
  const nextMessageIdRef = useRef<string>(Date.now().toString())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sessionRef = useRef<any>(null)
  const activityIconRef = useRef<AudioLinesIconHandle>(null)

  useEffect(() => {
    // Initialize Chrome AI session
    const initSession = async () => {
      try {
        if (window.ai?.languageModel) {
          sessionRef.current = await window.ai.languageModel.create()
        }
      } catch (error) {
        console.error("Failed to initialize AI session:", error)
      }
    }
    initSession()
  }, [])

  useEffect(() => {
    // Control activity icon animation based on recording state
    if (isRecording) {
      activityIconRef.current?.startAnimation()
    } else {
      activityIconRef.current?.stopAnimation()
    }
  }, [isRecording])

  useEffect(() => {
    // Auto-scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return

    const messageId = nextMessageIdRef.current
    const userMessage: Message = {
      id: messageId,
      role: 'user',
      content: input.trim(),
      text: input.trim()
    }

    const userInput = input.trim()
    setPendingMessageId(messageId)
    setMessages(prev => [...prev, userMessage])
    setInput("")
    
    // Generate next message ID for the next preview
    nextMessageIdRef.current = Date.now().toString()
    
    // Wait for animation to complete (300ms for the transition)
    await new Promise(resolve => setTimeout(resolve, 300))
    
    setPendingMessageId(null)
    setIsLoading(true)

    try {
      // Check if Chrome AI API is available
      if (!window.ai || !window.ai.languageModel) {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "Chrome AI is not available. Please make sure you're using Chrome Canary with AI features enabled.",
          text: "Chrome AI is not available. Please make sure you're using Chrome Canary with AI features enabled."
        }
        setMessages(prev => [...prev, errorMessage])
        return
      }

      // Get or create session
      if (!sessionRef.current) {
        sessionRef.current = await window.ai.languageModel.create()
      }

      const result = await sessionRef.current.prompt(userInput)
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result,
        text: result
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${error.message || 'Failed to get AI response'}`,
        text: `Error: ${error.message || 'Failed to get AI response'}`
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleClearChat = () => {
    setMessages([])
    // Optionally reset the session
    sessionRef.current = null
  }

  const handleStop = () => {
    setIsLoading(false)
  }

  const handleMicClick = () => {
    setIsRecording(!isRecording)
    if (!isRecording) {
      activityIconRef.current?.startAnimation()
    } else {
      activityIconRef.current?.stopAnimation()
    }
  }

  return (
    <div style={{ 
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%', 
      height: '100vh', 
      overflow: 'hidden',
      margin: 0,
      padding: 0,
      background: '#0a0e1a'
    }}>
      <CopilotChatWindow
        messages={messages}
        input={input}
        setInput={setInput}
        onSendMessage={handleSendMessage}
        onKeyPress={handleKeyPress}
        onClearChat={handleClearChat}
        isLoading={isLoading}
        messagesEndRef={messagesEndRef}
        onStop={handleStop}
        pendingMessageId={pendingMessageId}
        nextMessageId={nextMessageIdRef.current}
        isRecording={isRecording}
        onMicClick={handleMicClick}
      />
      
      {/* Floating Recording Pill - Rendered at top level */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            className="voice-recording-pill"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={handleMicClick}
          >
            <AudioLinesIcon ref={activityIconRef} size={16} style={{ color: 'white' }} />
            <span className="recording-text">Click to finish recording</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default SidePanel

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
