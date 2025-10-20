import { useState, useRef, useEffect } from "react";
import { CopilotChatWindow } from "./components/CopilotChatWindow";
import { McpManager } from "./components/McpManager";
import { ToolUIProvider } from "./ai/ToolUIContext";
import { ThreadList } from "./components/ThreadList";
import { MemoryPanel } from "./components/MemoryPanel";
import "./styles/copilot.css";
import "./styles/mcp.css";
import "./styles/mcp-tools.css";
import "./styles/memory.css";
import "./sidepanel.css";
import { createLogger } from "./logger";
import { useRegisterAllActions } from "./actions/registerAll";
import {
    db,
    createThread,
    loadThreadMessages,
    clearThreadMessages,
    updateThreadTitle,
    getLastActiveThreadId,
    setLastActiveThreadId,
    getBrowserSessionId,
    setBrowserSessionId,
    type ChatMessage
} from "./db";
import { generateThreadTitle } from "./utils/summarizer";
import { getBehavioralPreferences } from "./memory/store";
import { useAIChat } from "./ai/useAIChat";
import type { UIMessage } from "ai";
import { extractPageContext, formatPageContextForAI } from "./utils/pageContextExtractor";

/**
 * Inner component that uses AI SDK v5
 * Uses custom ChromeExtensionTransport for service worker communication
 */
function AIChatContent() {
    const log = createLogger("SidePanel-AI-SDK");
    
    useRegisterAllActions();
    
    const [input, setInput] = useState('');
    const [showMcp, setShowMcp] = useState(false);
    const [showThreads, setShowThreads] = useState(false);
    const [showMemory, setShowMemory] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [currentTab, setCurrentTab] = useState<{ url?: string, title?: string }>({});
    const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
    const [behavioralPreferences, setBehavioralPreferences] = useState<Record<string, unknown>>({});
    const sessionIdRef = useRef<string>(Date.now().toString());

    // Use AI SDK v5 chat hook with ChromeExtensionTransport
    const aiChat = useAIChat({
        threadId: currentThreadId || 'default',
        onError: (error) => {
            log.error('AI Chat error', error);
        },
        onFinish: (result) => {
            log.info('AI response finished', { messageId: result.message.id });
        },
    });

    const {
        messages,
        sendMessage,
        status,
        stop,
        setMessages,
    } = aiChat;

    const isLoading = status === 'submitted' || status === 'streaming';

    // Track current tab context
    useEffect(() => {
        const updateTabContext = async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab) {
                    setCurrentTab({ url: tab.url, title: tab.title });
                }
            } catch (error) {
                log.error("Failed to get current tab", error);
            }
        };
        updateTabContext();
        const interval = setInterval(updateTabContext, 2000);
        return () => clearInterval(interval);
    }, []);

    // Load behavioral preferences for context injection
    useEffect(() => {
        const loadPreferences = async () => {
            try {
                const prefs = await getBehavioralPreferences();
                setBehavioralPreferences(prefs);
            } catch (error) {
                log.error("Failed to load behavioral preferences", error);
            }
        };
        loadPreferences();
        // Refresh every 30 seconds
        const interval = setInterval(loadPreferences, 30000);
        return () => clearInterval(interval);
    }, []);

    // Load messages from IndexedDB on mount or thread change
    useEffect(() => {
        const loadMessages = async () => {
            try {
                if (!currentThreadId) {
                    // Use the session ID from ref (generated once per panel mount)
                    const currentSessionId = sessionIdRef.current;

                    // Panel was just closed/reopened - try to restore last active thread
                    const lastThreadId = await getLastActiveThreadId();

                    if (lastThreadId) {
                        log.info("Restoring last active thread", { threadId: lastThreadId });
                        setCurrentThreadId(lastThreadId);
                        // Update session timestamp to keep session alive
                        await setBrowserSessionId(currentSessionId);
                        return;
                    }

                    // No last thread found - create a new one
                    const thread = await createThread();
                    setCurrentThreadId(thread.id);
                    await setLastActiveThreadId(thread.id);
                    await setBrowserSessionId(currentSessionId);
                    log.info("Created new thread", { threadId: thread.id });
                    return;
                }

                const storedMessages = await loadThreadMessages(currentThreadId);
                if (storedMessages.length > 0) {
                    log.info("Loading thread messages from DB", { threadId: currentThreadId, count: storedMessages.length });

                    // Convert DB messages to AI SDK v5 UIMessage format
                    const uiMessages: UIMessage[] = storedMessages.map((msg: ChatMessage) => ({
                        id: msg.id,
                        role: msg.role,
                        parts: [{ type: 'text', text: msg.content }],
                        createdAt: new Date(msg.timestamp),
                    }));

                    setMessages(uiMessages);
                }

                // Update the last active thread whenever thread changes
                await setLastActiveThreadId(currentThreadId);

            } catch (error) {
                log.error("Failed to load thread messages", error);
            }
        };

        loadMessages();
    }, [currentThreadId]); // Reload when thread changes

    // Save messages to IndexedDB when they change
    useEffect(() => {
        const saveMessages = async () => {
            if (messages.length === 0 || !currentThreadId) return;

            try {
                // Clear existing messages for this thread and save new ones
                await clearThreadMessages(currentThreadId);

                // Convert AI SDK v5 UIMessage to DB format
                const dbMessages: ChatMessage[] = messages
                    .filter((msg) => {
                        // Extract text from parts
                        const text = msg.parts
                            ?.filter((part: any) => part.type === 'text')
                            .map((part: any) => part.text)
                            .join('');
                        return text && text.trim().length > 0;
                    })
                    .map((msg) => {
                        const text = msg.parts
                            ?.filter((part: any) => part.type === 'text')
                            .map((part: any) => part.text)
                            .join('') || '';

                        return {
                            id: msg.id,
                            threadId: currentThreadId,
                            role: msg.role as 'user' | 'assistant',
                            content: text,
                            timestamp: (msg as any).createdAt ? new Date((msg as any).createdAt).getTime() : Date.now(),
                        };
                    });

                if (dbMessages.length > 0) {
                    await db.chatMessages.bulkAdd(dbMessages);
                    log.info("Saved thread messages to DB", { threadId: currentThreadId, count: dbMessages.length });
                }

                // Generate thread title after every assistant response (non-blocking)
                if (messages.length >= 2) {
                    const lastMessage = messages[messages.length - 1];

                    // Check if the last message is from the assistant
                    if (lastMessage && lastMessage.role === 'assistant') {
                        log.info("Generating thread title after assistant response");

                        // Get all user and assistant messages for full context
                        const userMessages = messages.filter((msg) => msg.role === 'user');
                        const assistantMessages = messages.filter((msg) => msg.role === 'assistant');

                        if (userMessages.length > 0 && assistantMessages.length > 0) {
                            // Combine ALL user and assistant messages for comprehensive context
                            const conversationContext = messages
                                .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
                                .map((msg) => {
                                    const text = msg.parts
                                        ?.filter((part: any) => part.type === 'text')
                                        .map((part: any) => part.text)
                                        .join('') || '';
                                    return `${msg.role === 'user' ? 'User' : 'Assistant'}: ${text}`;
                                })
                                .join('\n\n');

                            // Generate title asynchronously (don't block)
                            generateThreadTitle(conversationContext, {
                                maxLength: 40,
                                context: 'This is a chat conversation. Generate a concise headline summarizing the main topic.',
                                onDownloadProgress: (progress) => {
                                    log.info(`Summarizer model download: ${(progress * 100).toFixed(1)}%`);
                                }
                            }).then(title => {
                                updateThreadTitle(currentThreadId, title);
                                log.info("Updated thread title in background", { threadId: currentThreadId, title });
                            }).catch(error => {
                                log.error("Failed to generate thread title in background", error);
                            });
                        }
                    }
                }
            } catch (error) {
                log.error("Failed to save thread messages", error);
            }
        };

        saveMessages();
    }, [JSON.stringify(messages), currentThreadId]); // Save when messages or thread changes

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        log.debug("Messages changed", { count: messages.length });
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Handle sending messages
    const handleSendMessage = async (messageText?: string) => {
        // Use provided messageText or fall back to input state
        const textToSend = messageText !== undefined ? messageText : input;
        const trimmedInput = textToSend.trim();

        if (!trimmedInput || isLoading) {
            return;
        }

        log.info("SendMessage", { length: trimmedInput.length, fromVoice: messageText !== undefined });
        
        // Only clear input if we're using the input state (not voice input)
        if (messageText === undefined) {
            setInput('');
        }

        // Extract page context and inject it with the user message
        let messageWithContext = trimmedInput;
        try {
            const pageContext = await extractPageContext();
            if (pageContext) {
                const contextFormatted = formatPageContextForAI(pageContext);
                
                // Inject page context BEFORE user message
                messageWithContext = `[AUTOMATIC PAGE CONTEXT - Current tab information]\n${contextFormatted}\n\n[USER MESSAGE]\n${trimmedInput}`;
                
                log.info("Injected page context", { 
                    url: pageContext.url, 
                    inputs: pageContext.inputs.length, 
                    buttons: pageContext.buttons.length,
                    links: pageContext.links.length
                });
            }
        } catch (error) {
            log.warn("Failed to extract page context, sending message without it", error);
        }

        // Send message using AI SDK v5 sendMessage with injected context
        sendMessage({ text: messageWithContext });
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (input.trim().length > 0) {
                handleSendMessage();
            }
        }
    };

    // Handle clearing all messages for current thread
    const handleClearChat = async () => {
        if (!currentThreadId) return;

        if (window.confirm('Are you sure you want to clear the chat history for this thread?')) {
            try {
                log.info("Clearing thread messages", { threadId: currentThreadId });

                // Clear AI SDK messages
                setMessages([]);

                // Clear IndexedDB messages for this thread
                await clearThreadMessages(currentThreadId);

                log.info("Thread messages cleared successfully");
            } catch (error) {
                log.error("Failed to clear thread messages", error);
            }
        }
    };

    // Handle creating a new thread
    const handleNewThread = async () => {
        try {
            const thread = await createThread();
            setCurrentThreadId(thread.id);
            setMessages([]);
            await setLastActiveThreadId(thread.id);
            log.info("Created new thread", { threadId: thread.id });
        } catch (error) {
            log.error("Failed to create new thread", error);
        }
    };

    // Handle selecting a thread
    const handleThreadSelect = async (threadId: string) => {
        setCurrentThreadId(threadId);
        await setLastActiveThreadId(threadId);
    };

    // Render MCP Manager, Thread List, Memory Panel, or Chat Window
    if (showMcp) {
        return <McpManager onBack={() => setShowMcp(false)} />;
    }

    if (showThreads) {
        return (
            <ThreadList
                currentThreadId={currentThreadId}
                onThreadSelect={handleThreadSelect}
                onNewThread={handleNewThread}
                onBack={() => setShowThreads(false)}
            />
        );
    }

    return (
        <>
            {/* MCP and Tools commented out for now */}
            {/* <ToolRenderer /> */}

            {/* Memory Panel - Side panel overlay */}
            <MemoryPanel isOpen={showMemory} onClose={() => setShowMemory(false)} />

            <CopilotChatWindow
                messages={messages.filter(m => m.role !== 'system') as any}
                input={input}
                setInput={setInput}
                onSendMessage={handleSendMessage}
                onKeyDown={handleKeyPress}
                onClearChat={handleClearChat}
                onSettingsClick={() => setShowMcp(true)}
                onThreadsClick={() => setShowThreads(true)}
                onMemoryClick={() => setShowMemory(true)}
                onNewThreadClick={handleNewThread}
                onStop={stop}
                isLoading={isLoading}
                messagesEndRef={messagesEndRef}
            />
        </>
    );
}

/**
 * Main Side Panel component with AI SDK v5
 * Now using custom ChromeExtensionTransport for service worker communication
 */
function SidePanel() {
    return (
        <ToolUIProvider>
            <AIChatContent />
        </ToolUIProvider>
    );
}

export default SidePanel;

// TypeScript declarations
declare global {
    interface Window {
        chrome: typeof chrome;
    }
}
