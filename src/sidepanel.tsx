import { useState, useEffect, useRef } from "react";
import { MessageList } from "./components/ChatMessage";
import { saveChatMessage, loadChatHistory, clearChatHistory } from "./db";
import type { ChatMessage } from "./db";
import "./sidepanel.css";

interface PromptAPIStatus {
  available: 'readily' | 'downloading' | 'no' | 'downloaded'
  downloading: boolean
  downloadProgress: number
}

function SidePanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<any | null>(null);
  const [promptAPIStatus, setPromptAPIStatus] = useState<PromptAPIStatus>({
    available: 'no',
    downloading: false,
    downloadProgress: 0
  });
  const [useStreaming, setUseStreaming] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastUserMessageRef = useRef<string>("");

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Initialize Prompt API and load chat history
  useEffect(() => {
    const init = async () => {
      // Load persisted chat history
      try {
        const history = await loadChatHistory();
        setMessages(history);
      } catch (error) {
        console.error('[SidePanel] Failed to load chat history:', error);
      }

      // Initialize Prompt API
      try {
        const availability = await window.LanguageModel.availability();
        console.log('[SidePanel] LanguageModel availability:', availability);

        if (availability === 'available' || availability === undefined) {
          console.log('[SidePanel] Prompt API is available and model is ready.');
          setPromptAPIStatus({ available: 'downloaded', downloading: false, downloadProgress: 100 });
          
          const newSession = await window.LanguageModel.create({
            expectedInputs: [{ type: "text", languages: ["en"] }],
            expectedOutputs: [{ type: "text", languages: ["en"] }],
            systemInstruction: `You are a helpful AI assistant built for a Chrome AI hackathon.
The user will ask questions or request help in English.
Always respond clearly, concisely, and in English.
Focus on practical, developer-friendly solutions and examples.
You are running in a Chrome extension side panel.`
          });
          
          setSession(newSession);
          return;
        }

        if (availability === 'no') {
          setPromptAPIStatus({ available: 'no', downloading: false, downloadProgress: 0 });
          return;
        }

        if (availability === 'readily') {
          setPromptAPIStatus({ available: 'readily', downloading: false, downloadProgress: 0 });
          return;
        }

        if (availability === 'downloading') {
          setPromptAPIStatus({ available: 'downloading', downloading: true, downloadProgress: 0 });
          
          const newSession = await window.LanguageModel.create({
            expectedInputs: [{ type: "text", languages: ["en"] }],
            expectedOutputs: [{ type: "text", languages: ["en"] }],
            systemInstruction: `You are a helpful AI assistant built for a Chrome AI hackathon.
The user will ask questions or request help in English.
Always respond clearly, concisely, and in English.
Focus on practical, developer-friendly solutions and examples.
You are running in a Chrome extension side panel.`,
            monitor(m) {
              m.addEventListener('downloadprogress', (e: any) => {
                const progress = Math.round((e.loaded || 0) * 100);
                console.log('[SidePanel] Download progress:', progress, '%');
                setPromptAPIStatus({
                  available: 'downloading',
                  downloading: progress < 100,
                  downloadProgress: progress
                });
              });
            }
          });
          
          setSession(newSession);
          setPromptAPIStatus({ available: 'downloaded', downloading: false, downloadProgress: 100 });
        }
      } catch (error) {
        console.error('[SidePanel] Error initializing Prompt API:', error);
        setPromptAPIStatus({ available: 'no', downloading: false, downloadProgress: 0 });
      }
    };

    init();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !session || loading) return;

    const userMessage = inputValue.trim();
    lastUserMessageRef.current = userMessage;
    setInputValue("");
    setLoading(true);

    try {
      // Save user message
      const savedUserMsg = await saveChatMessage({
        role: 'user',
        content: userMessage
      });
      setMessages(prev => [...prev, savedUserMsg]);

      let assistantContent = "";

      if (useStreaming) {
        // Use streaming API
        const stream = session.promptStreaming(userMessage);
        
        // Create a placeholder assistant message
        const assistantMsg = await saveChatMessage({
          role: 'assistant',
          content: '',
          metadata: { streaming: true }
        });
        setMessages(prev => [...prev, assistantMsg]);

        for await (const chunk of stream) {
          assistantContent += chunk;
          // Update the message in state
          setMessages(prev => 
            prev.map(msg => 
              msg.id === assistantMsg.id 
                ? { ...msg, content: assistantContent }
                : msg
            )
          );
        }

        // Update the message in database with final content
        await saveChatMessage({
          role: 'assistant',
          content: assistantContent
        });
        
        // Remove the placeholder and add the final message
        const finalMsg = await saveChatMessage({
          role: 'assistant',
          content: assistantContent
        });
        
        setMessages(prev => 
          prev.map(msg => 
            msg.id === assistantMsg.id 
              ? finalMsg
              : msg
          )
        );
      } else {
        // Use non-streaming API
        const result = await session.prompt(userMessage);
        assistantContent = result;

        const assistantMsg = await saveChatMessage({
          role: 'assistant',
          content: assistantContent
        });
        setMessages(prev => [...prev, assistantMsg]);
      }
    } catch (error: any) {
      console.error('[SidePanel] Error getting AI response:', error);
      
      const errorMsg = await saveChatMessage({
        role: 'assistant',
        content: `Error: ${error.message || 'Failed to get AI response'}`,
        metadata: { error: true }
      });
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = async () => {
    if (window.confirm('Are you sure you want to clear all chat history?')) {
      try {
        await clearChatHistory();
        setMessages([]);
      } catch (error) {
        console.error('[SidePanel] Error clearing chat:', error);
      }
    }
  };

  const handleRegenerate = async (messageId: string) => {
    if (!session || loading || !lastUserMessageRef.current) return;

    // Find the message to regenerate and remove it along with subsequent messages
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    // Remove from state
    setMessages(prev => prev.slice(0, messageIndex));

    setLoading(true);

    try {
      let assistantContent = "";

      if (useStreaming) {
        const stream = session.promptStreaming(lastUserMessageRef.current);
        
        const assistantMsg = await saveChatMessage({
          role: 'assistant',
          content: '',
          metadata: { streaming: true, regenerated: true }
        });
        setMessages(prev => [...prev, assistantMsg]);

        for await (const chunk of stream) {
          assistantContent += chunk;
          setMessages(prev => 
            prev.map(msg => 
              msg.id === assistantMsg.id 
                ? { ...msg, content: assistantContent }
                : msg
            )
          );
        }

        const finalMsg = await saveChatMessage({
          role: 'assistant',
          content: assistantContent,
          metadata: { regenerated: true }
        });
        
        setMessages(prev => 
          prev.map(msg => 
            msg.id === assistantMsg.id 
              ? finalMsg
              : msg
          )
        );
      } else {
        const result = await session.prompt(lastUserMessageRef.current);
        assistantContent = result;

        const assistantMsg = await saveChatMessage({
          role: 'assistant',
          content: assistantContent,
          metadata: { regenerated: true }
        });
        setMessages(prev => [...prev, assistantMsg]);
      }
    } catch (error: any) {
      console.error('[SidePanel] Error regenerating response:', error);
      
      const errorMsg = await saveChatMessage({
        role: 'assistant',
        content: `Error: ${error.message || 'Failed to regenerate response'}`,
        metadata: { error: true }
      });
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (err) {
      console.error('[SidePanel] Failed to copy:', err);
    }
  };

  const openHistory = async () => {
    const url = chrome.runtime.getURL("tabs/history.html");
    try {
      await chrome.tabs.create({ url });
    } catch (error) {
      console.error('[SidePanel] Failed to open history:', error);
    }
  };

  return (
    <div className="sidepanel-container">
      {/* Header */}
      <div className="sidepanel-header">
        <div className="header-title">
          <h1>🤖 Chrome AI Assistant</h1>
          <p className="subtitle">Powered by on-device AI</p>
        </div>
        
        <div className="header-actions">
          <button 
            className="icon-button" 
            onClick={openHistory}
            title="Open History Search"
            aria-label="Open history search page"
          >
            🔍
          </button>
          
          <button 
            className="icon-button"
            onClick={handleClearChat}
            title="Clear Chat"
            aria-label="Clear all chat messages"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {(promptAPIStatus.downloading || promptAPIStatus.available === 'downloading') && (
        <div className="status-banner downloading">
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
        <div className="status-banner error">
          Chrome Prompt API is not available. Please use Chrome Canary 128+ with AI features enabled.
        </div>
      )}

      {promptAPIStatus.available === 'readily' && (
        <div className="status-banner warning">
          Chrome AI is supported but there's not enough disk space to download the model. Please free up some space.
        </div>
      )}

      {/* Messages Container */}
      <div className="messages-container">
        <MessageList 
          messages={messages}
          isLoading={loading}
          onCopy={handleCopy}
          onRegenerate={handleRegenerate}
        />
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="input-form">
        <div className="form-controls">
          <label className="toggle-container">
            <input
              type="checkbox"
              checked={useStreaming}
              onChange={(e) => setUseStreaming(e.target.checked)}
            />
            <span className="toggle-label">Stream responses</span>
          </label>
        </div>
        
        <div className="input-container">
          <textarea
            className="message-input"
            placeholder="Ask me anything..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            rows={2}
            disabled={!session || loading}
          />
          <button
            type="submit"
            className="send-button"
            disabled={!inputValue.trim() || !session || loading}
            aria-label="Send message"
          >
            {loading ? '⏳' : '📤'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default SidePanel;

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


