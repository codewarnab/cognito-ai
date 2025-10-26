import { useState, useRef, useEffect } from "react";
import { motion } from 'framer-motion';
import { CopilotChatWindow } from "./components/CopilotChatWindow";
import { McpManager } from "./components/McpManager";
import { ToolUIProvider } from "./ai/ToolUIContext";
import { ThreadListSidePanel } from "./components/ThreadListSidePanel";
import { MemorySidebar } from "./components/MemorySidebar";
import { ReminderPanel } from "./components/ReminderPanel";
import { OnboardingScreen } from "./components/OnboardingScreen";
import { AudioLinesIcon } from "./components/AudioLinesIcon";
import type { AudioLinesIconHandle } from "./components/AudioLinesIcon";
import { VoiceModeUI } from "./components/voice/VoiceModeUI";
import { VoiceRecordingPill } from "./components/VoiceRecordingPill";
import type { VoiceInputHandle } from "./audio/VoiceInput";
import "./styles/copilot.css";
import "./styles/mcp.css";
import "./styles/mcp-tools.css";
import "./styles/memory.css";
import "./styles/memory-sidebar.css";
import "./styles/mentions.css";
import "./styles/thread-sidepanel.css";
import "./styles/reminder.css";
import "./styles/workflows.css";
import "./styles/voice-recording-pill.css";
import "./styles/onboarding.css";
import "./styles/local-banner.css";
import "./sidepanel.css";
import { createLogger } from "./logger";
import { useRegisterAllActions } from "./actions/registerAll";
import { useRegisterAllWorkflows } from "./workflows/registerAll";
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
import { processFile, getFileIcon, formatFileSize } from "./utils/fileProcessor";
import type { FileAttachmentData } from "./components/chat/FileAttachment";
import { getModelConfig, setConversationStartMode } from "./utils/modelSettings";

// Type definition for chat mode
type ChatMode = 'text' | 'voice';

/**
 * Inner component that uses AI SDK v5
 * Uses custom ChromeExtensionTransport for service worker communication
 */
function AIChatContent() {
    const log = createLogger("SidePanel-AI-SDK");

    useRegisterAllActions();
    useRegisterAllWorkflows();
    const [input, setInput] = useState('');
    const [showMcp, setShowMcp] = useState(false);
    const [showThreads, setShowThreads] = useState(false);
    const [showMemory, setShowMemory] = useState(false);
    const [showReminders, setShowReminders] = useState(false);
    // Lazy initialization for onboarding state - will be hydrated in useEffect
    const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null); // null = loading
    const [showChatInterface, setShowChatInterface] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [showPill, setShowPill] = useState(false);
    const [mode, setMode] = useState<ChatMode>('text');
    const [apiKey, setApiKey] = useState<string>('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [currentTab, setCurrentTab] = useState<{ url?: string, title?: string }>({});
    const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
    const [behavioralPreferences, setBehavioralPreferences] = useState<Record<string, unknown>>({});
    const sessionIdRef = useRef<string>(Date.now().toString());
    const audioLinesIconRef = useRef<AudioLinesIconHandle>(null);
    const voiceInputRef = useRef<VoiceInputHandle>(null);

    // Reset onboarding for testing (can be called from console)
    const resetOnboarding = async () => {
        try {
            await chrome.storage.local.remove(['onboarding_completed']);
            setShowOnboarding(true);
            setShowChatInterface(false);
            log.info('Onboarding reset');
        } catch (error) {
            log.error('Failed to reset onboarding', error);
        }
    };

    // Expose test functions globally (defined once, not in effect)
    if (typeof window !== 'undefined') {
        (window as any).resetOnboarding = resetOnboarding;
        (window as any).showOnboarding = () => {
            setShowOnboarding(true);
            setShowChatInterface(false);
        };
        (window as any).hideOnboarding = () => {
            setShowOnboarding(false);
            setShowChatInterface(true);
        };
    }

    // Use AI SDK v5 chat hook with ChromeExtensionTransport
    const aiChat = useAIChat({
        threadId: currentThreadId || 'default',
        onError: (error) => {
            log.error('AI Chat error', error);
        },
        onFinish: async (result) => {
            log.info('AI response finished', { messageId: result.message.id });

            // Save messages to IndexedDB after AI response completes
            if (result.messages && result.messages.length > 0 && currentThreadId) {
                try {
                    // Clear existing messages for this thread and save new ones
                    await clearThreadMessages(currentThreadId);

                    // Store complete UIMessage objects to preserve tool calls and results
                    const dbMessages: ChatMessage[] = result.messages
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

                        log.info("💾 Saved thread messages to DB after AI response", {
                            threadId: currentThreadId,
                            totalMessages: dbMessages.length,
                            messagesWithTools: toolCallCount,
                            totalToolParts,
                            preservesToolUI: true
                        });
                    }

                    // Generate thread title after assistant response (non-blocking)
                    if (result.messages.length >= 2 && result.message.role === 'assistant') {
                        log.info("Generating thread title after assistant response");

                        // Get all user and assistant messages for full context
                        const conversationContext = result.messages
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
                            log.info("Updated thread title after AI response", { threadId: currentThreadId, title });
                        }).catch(error => {
                            log.error("Failed to generate thread title", error);
                        });
                    }
                } catch (error) {
                    log.error("Failed to save messages after AI response", error);
                }
            }
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

    // Load API key from storage with improved error handling
    useEffect(() => {
        const loadApiKey = async () => {
            try {
                const result = await chrome.storage.local.get(['gemini_api_key']);
                if (result.gemini_api_key) {
                    setApiKey(result.gemini_api_key);
                    log.debug('API key loaded from storage');
                } else {
                    log.debug('No API key found in storage');
                }
            } catch (error) {
                log.error('Failed to load API key', error);
                // Fail silently - API key is optional
            }
        };
        loadApiKey();
    }, []);

    // Listen for API key changes in storage
    useEffect(() => {
        const handleStorageChange = (
            changes: { [key: string]: chrome.storage.StorageChange },
            areaName: string
        ) => {
            if (areaName === 'local' && changes.gemini_api_key) {
                // API key was added, updated, or removed
                const newApiKey = changes.gemini_api_key.newValue || '';
                setApiKey(newApiKey);
                log.debug('API key updated from storage change:', newApiKey ? 'set' : 'removed');
            }
        };

        chrome.storage.onChanged.addListener(handleStorageChange);

        return () => {
            chrome.storage.onChanged.removeListener(handleStorageChange);
        };
    }, []);

    // Check if onboarding should be shown with improved error handling
    useEffect(() => {
        const checkOnboardingStatus = async () => {
            try {
                const result = await chrome.storage.local.get(['onboarding_completed']);
                log.info('Onboarding status check', {
                    onboarding_completed: result.onboarding_completed,
                });
                if (result.onboarding_completed) {
                    setShowOnboarding(false);
                    setShowChatInterface(true);
                    log.info('Onboarding already completed, hiding onboarding');
                } else {
                    setShowOnboarding(true);
                    setShowChatInterface(false);
                    log.info('Onboarding not completed, showing onboarding');
                }
            } catch (error) {
                log.error('Failed to check onboarding status', error);
                // On error, default to showing chat interface (fail gracefully)
                setShowOnboarding(false);
                setShowChatInterface(true);
            }
        };
        checkOnboardingStatus();
    }, []);

    // Handle onboarding completion
    const handleOnboardingComplete = async () => {
        try {
            await chrome.storage.local.set({ onboarding_completed: true });
            setShowOnboarding(false);
            setShowChatInterface(true);
            log.info('Onboarding completed, showing chat interface');
        } catch (error) {
            log.error('Failed to save onboarding status', error);
            setShowOnboarding(false);
            setShowChatInterface(true);
        }
    };

    // Handle onboarding skip
    const handleOnboardingSkip = async () => {
        try {
            await chrome.storage.local.set({ onboarding_completed: true });
            setShowOnboarding(false);
            setShowChatInterface(true);
            log.info('Onboarding skipped, showing chat interface');
        } catch (error) {
            log.error('Failed to save onboarding skip status', error);
            setShowOnboarding(false);
            setShowChatInterface(true);
        }
    };

    // Handle mode change with cleanup
    const handleModeChange = async (newMode: ChatMode) => {
        if (mode === newMode) return;

        // Prevent switching during active recording
        if (isRecording) {
            log.warn('Cannot switch mode while recording');
            return;
        }

        log.info('Switching mode', { from: mode, to: newMode });
        setMode(newMode);
    };

    // Track current tab context using Chrome events instead of polling
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

        // Initial load
        updateTabContext();

        // Listen for tab activation (user switches tabs)
        const handleTabActivated = () => {
            updateTabContext();
        };

        // Listen for tab updates (URL or title changes)
        const handleTabUpdated = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
            // Only update if URL or title changed for the active tab
            if (changeInfo.url || changeInfo.title) {
                chrome.tabs.query({ active: true, currentWindow: true }, ([activeTab]) => {
                    if (activeTab && activeTab.id === tabId) {
                        updateTabContext();
                    }
                });
            }
        };

        // Add event listeners
        chrome.tabs.onActivated.addListener(handleTabActivated);
        chrome.tabs.onUpdated.addListener(handleTabUpdated);

        return () => {
            chrome.tabs.onActivated.removeListener(handleTabActivated);
            chrome.tabs.onUpdated.removeListener(handleTabUpdated);
        };
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
        // Refresh every 5 minutes (increased from 30 seconds to reduce overhead)
        // Preferences don't change frequently, so less aggressive polling is acceptable
        const interval = setInterval(loadPreferences, 300000);
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

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        log.debug("Messages changed", { count: messages.length });
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Handle sending messages
    const handleSendMessage = async (messageText?: string, attachments?: FileAttachmentData[], workflowId?: string) => {
        // Use provided messageText or fall back to input state
        const textToSend = messageText !== undefined ? messageText : input;
        const trimmedInput = textToSend.trim();

        if (!trimmedInput && (!attachments || attachments.length === 0)) {
            return;
        }

        if (isLoading) {
            return;
        }

        log.info("SendMessage", {
            length: trimmedInput.length,
            fromVoice: messageText !== undefined,
            hasAttachments: attachments && attachments.length > 0,
            attachmentCount: attachments?.length || 0,
            workflowId: workflowId || 'none'
        });

        // Track conversation start mode on first message
        if (messages.length === 0) {
            try {
                const config = await getModelConfig();
                if (!config.conversationStartMode) {
                    // First message in conversation - lock the mode
                    await setConversationStartMode(config.mode);
                    log.info("Locked conversation mode", { mode: config.mode });
                }
            } catch (error) {
                log.warn("Failed to set conversation start mode", error);
            }
        }

        // Only clear input if we're using the input state (not voice input)
        if (messageText === undefined) {
            setInput('');
        }

        // If workflow is specified, prepend workflow command to message
        let finalMessage = trimmedInput;
        if (workflowId) {
            // Add workflow metadata to message experimental data
            log.info("Workflow mode active", { workflowId });
            // The workflow will be handled by the AI logic layer
            // For now, we'll just pass it through in the message
            finalMessage = `/${workflowId} ${trimmedInput}`;
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

        // Process attachments if present
        if (attachments && attachments.length > 0) {
            try {
                log.info("Processing file attachments", { count: attachments.length });

                // Process each file
                const processedFiles = await Promise.all(
                    attachments.map(async (att) => {
                        try {
                            return await processFile(att.file);
                        } catch (error) {
                            log.error("Failed to process file", { name: att.file.name, error });
                            return null;
                        }
                    })
                );

                // Filter out failed files
                const validFiles = processedFiles.filter(f => f !== null);

                if (validFiles.length > 0) {
                    log.info("Files processed successfully", {
                        total: attachments.length,
                        successful: validFiles.length,
                        images: validFiles.filter(f => f!.isImage).length
                    });

                    // Build message parts for multimodal support (AI SDK v5 format)
                    const messageParts: any[] = [];

                    // Add text content first (only if provided)
                    if (finalMessage) {
                        messageParts.push({
                            type: 'text',
                            text: finalMessage
                        });
                    }

                    // Add files in AI SDK v5 format: { type: 'file', mediaType: string, url: string }
                    for (const file of validFiles) {
                        messageParts.push({
                            type: 'file',
                            mediaType: file!.mimeType,
                            url: `data:${file!.mimeType};base64,${file!.content}`,
                            name: file!.name,
                            size: file!.size
                        });

                    }

                    // Send multimodal message with parts (AI SDK v5 format)
                    sendMessage({
                        role: 'user',
                        parts: messageParts
                    } as any);

                    return;
                }
            } catch (error) {
                log.error("Failed to process attachments", error);
                alert("Failed to process some attachments. Please try again.");
            }
        }

        // Send text-only message if no valid attachments
        // Context is handled in system prompt via SimpleFrontendTransport
        sendMessage({ text: finalMessage });
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

    // Handle voice recording state changes from VoiceInput
    const handleRecordingChange = (recording: boolean) => {
        setIsRecording(recording);

        if (recording) {
            // Show pill and start animation when recording starts
            setShowPill(true);
            audioLinesIconRef.current?.startAnimation();
            log.info("Voice recording started");
        } else {
            // Hide pill and stop animation when recording stops
            audioLinesIconRef.current?.stopAnimation();
            setShowPill(false);
            log.info("Voice recording stopped");
        }
    };

    // Animation is now controlled by motion component callbacks

    // Render MCP Manager or Chat Window
    if (showMcp) {
        return <McpManager onBack={() => setShowMcp(false)} />;
    }

    // Show onboarding screen if enabled
    if (showOnboarding) {
        log.info('Rendering onboarding screen', { showOnboarding });
        return (
            <OnboardingScreen
                onComplete={handleOnboardingComplete}
                onSkip={handleOnboardingSkip}
                showSkip={true}
            />
        );
    }


    // Only render chat interface and overlays when not in onboarding/loading
    if (!showChatInterface) {
        return null; // Don't render anything when chat interface is hidden
    }

    return (
        <>
            {/* MCP and Tools commented out for now */}
            {/* <ToolRenderer /> */}

            {/* Memory Sidebar - Right sliding sidebar */}
            <MemorySidebar isOpen={showMemory} onClose={() => setShowMemory(false)} />

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

            {/* Chat Interface with slide-in animation */}
            {showChatInterface && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="chat-interface-container"
                >
                    {/* Conditional rendering based on mode */}
                    {mode === 'text' ? (
                        <>
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
                                onRecordingChange={handleRecordingChange}
                                voiceInputRef={voiceInputRef}
                            />

                            {/* Floating Recording Pill - Only in text mode */}
                            <VoiceRecordingPill
                                ref={audioLinesIconRef}
                                isVisible={showPill}
                                onStopRecording={() => {
                                    // Stop the voice recording
                                    voiceInputRef.current?.stopRecording();
                                }}
                            />

                            {/* Voice Mode FAB - Only in text mode */}
                            <motion.button
                                className={`voice-mode-fab ${messages.length > 0 ? 'has-messages' : ''}`}
                                onClick={() => handleModeChange('voice')}
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{
                                    type: 'spring',
                                    stiffness: 260,
                                    damping: 20,
                                    delay: 0.1
                                }}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                title="Switch to Voice Mode"
                            >
                                <AudioLinesIcon size={20} />
                            </motion.button>
                        </>
                    ) : (
                        <VoiceModeUI
                            onBack={() => setMode('text')}
                            apiKey={apiKey}
                            systemInstruction="You are an intelligent AI assistant integrated into a Chrome browser extension. Help users with browser navigation, web page interaction, information retrieval, and task management. Be conversational, friendly, and helpful. Keep responses concise since this is a voice conversation."
                        />
                    )}
                </motion.div>
            )}
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
