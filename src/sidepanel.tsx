import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from 'framer-motion';
import { CopilotChatWindow } from "./components/CopilotChatWindow";
import { McpManager } from "./components/McpManager";
import { ToolUIProvider } from "./ai/ToolUIContext";
import { ThreadListSidePanel } from "./components/ThreadListSidePanel";
import { MemoryPanel } from "./components/MemoryPanel";
import { ReminderPanel } from "./components/ReminderPanel";
import { AudioLinesIcon } from "./components/AudioLinesIcon";
import type { AudioLinesIconHandle } from "./components/AudioLinesIcon";
import "./styles/copilot.css";
import "./styles/mcp.css";
import "./styles/mcp-tools.css";
import "./styles/memory.css";
import "./styles/mentions.css";
import "./styles/thread-sidepanel.css";
import "./styles/reminder.css";
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
    const [showReminders, setShowReminders] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [showPill, setShowPill] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [currentTab, setCurrentTab] = useState<{ url?: string, title?: string }>({});
    const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
    const [behavioralPreferences, setBehavioralPreferences] = useState<Record<string, unknown>>({});
    const sessionIdRef = useRef<string>(Date.now().toString());
    const audioLinesIconRef = useRef<AudioLinesIconHandle>(null);

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

                    // Load complete UIMessage objects (already in correct format)
                    // This preserves all tool-call and tool-result parts for proper UI rendering
                    const uiMessages: UIMessage[] = storedMessages.map((msg: ChatMessage) => msg.message);

                    log.info("Restored messages with tool parts", {
                        totalMessages: uiMessages.length,
                        messagesWithTools: uiMessages.filter(m =>
                            m.parts?.some((p: any) =>
                                p.type === 'tool-call' ||
                                p.type === 'tool-result'
                            )
                        ).length
                    });

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

                // Store complete UIMessage objects to preserve tool calls and results
                const dbMessages: ChatMessage[] = messages
                    .map((msg, index) => {
                        // Filter out transient parts (temporary status messages)
                        const messageWithoutTransient = {
                            ...msg,
                            parts: msg.parts?.filter((part: any) => !part.transient)
                        };

                        // Extract timestamp from createdAt or use index-based timestamp
                        let timestamp: number;
                        if ((msg as any).createdAt) {
                            timestamp = new Date((msg as any).createdAt).getTime();
                        } else {
                            // Use base timestamp + index to ensure proper ordering
                            timestamp = Date.now() + index;
                        }

                        return {
                            id: msg.id,
                            threadId: currentThreadId,
                            message: messageWithoutTransient, // Store complete UIMessage
                            timestamp,
                            sequenceNumber: index, // Preserve exact order
                        };
                    });

                if (dbMessages.length > 0) {
                    await db.chatMessages.bulkAdd(dbMessages);

                    // Count messages with tool calls for logging
                    const toolCallCount = dbMessages.filter(msg =>
                        msg.message.parts?.some((p: any) =>
                            p.type === 'tool-call' ||
                            p.type === 'tool-result'
                        )
                    ).length;

                    const totalToolParts = dbMessages.reduce((sum, msg) =>
                        sum + (msg.message.parts?.filter((p: any) =>
                            p.type === 'tool-call' ||
                            p.type === 'tool-result'
                        ).length || 0), 0
                    );

                    log.info("💾 Saved thread messages to DB with complete UIMessage structure", {
                        threadId: currentThreadId,
                        totalMessages: dbMessages.length,
                        messagesWithTools: toolCallCount,
                        totalToolParts,
                        preservesToolUI: true
                    });
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

        // Capture page context ONLY for the first message in a new thread
        // This will be stored in the thread and injected into system prompt
        if (messages.length === 0 && currentThreadId) {
            try {
                const pageContext = await extractPageContext();
                if (pageContext) {
                    const contextFormatted = formatPageContextForAI(pageContext);

                    // Update the thread with initial page context
                    await db.chatThreads.update(currentThreadId, {
                        initialPageContext: contextFormatted
                    });

                    log.info("Captured initial page context for thread", {
                        threadId: currentThreadId,
                        url: pageContext.url,
                        inputs: pageContext.inputs.length,
                        buttons: pageContext.buttons.length,
                        links: pageContext.links.length
                    });
                }
            } catch (error) {
                log.warn("Failed to capture initial page context", error);
            }
        }

        // Send message directly without injecting context
        // Context is now handled in system prompt via SimpleFrontendTransport
        sendMessage({ text: trimmedInput });
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

    // Handle microphone click for voice recording
    const handleMicClick = () => {
        const newRecordingState = !isRecording;

        if (isRecording) {
            // Stop animation and hide pill immediately
            audioLinesIconRef.current?.stopAnimation();
            setShowPill(false);
        } else {
            // Show pill and start recording
            setShowPill(true);
        }

        setIsRecording(newRecordingState);
        log.info("Microphone clicked", { isRecording: newRecordingState });
    };

    // Animation is now controlled by motion component callbacks

    // Render MCP Manager or Chat Window
    if (showMcp) {
        return <McpManager onBack={() => setShowMcp(false)} />;
    }

    return (
        <>
            {/* MCP and Tools commented out for now */}
            {/* <ToolRenderer /> */}

            {/* Memory Panel - Side panel overlay */}
            <MemoryPanel isOpen={showMemory} onClose={() => setShowMemory(false)} />

            {/* Reminder Panel - Side panel overlay */}
            <ReminderPanel isOpen={showReminders} onClose={() => setShowReminders(false)} />

            {/* Thread List Side Panel */}
            <ThreadListSidePanel
                isOpen={showThreads}
                onClose={() => setShowThreads(false)}
                currentThreadId={currentThreadId}
                onThreadSelect={handleThreadSelect}
                onNewThread={handleNewThread}
            />

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
                onRemindersClick={() => setShowReminders(true)}
                onNewThreadClick={handleNewThread}
                onStop={stop}
                isLoading={isLoading}
                messagesEndRef={messagesEndRef}
                isRecording={isRecording}
                onMicClick={handleMicClick}
            />

            {/* Floating Recording Pill - Rendered at top level */}
            <AnimatePresence mode="wait">
                {showPill && (
                    <motion.div
                        className="voice-recording-pill"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        onAnimationStart={() => {
                            audioLinesIconRef.current?.startAnimation();
                        }}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleMicClick();
                        }}
                    >
                        <AudioLinesIcon
                            ref={audioLinesIconRef}
                            size={16}
                            style={{ color: 'white' }}
                        />
                        <span className="recording-text">Click to finish recording</span>
                    </motion.div>
                )}
            </AnimatePresence>
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
