import "./polyfills/process";
import { useState, useRef, useEffect } from "react";
import { motion } from 'framer-motion';
import { CopilotChatWindow } from "./components/core/CopilotChatWindow";
import { McpManager } from "./components/features/mcp";
import { Troubleshooting } from "./components/features/help/Troubleshooting";
import { Features } from "./components/features/help/Features";
import { ProviderSetup } from "./components/features/help/ProviderSetup";
import { ToolUIProvider } from "./ai/tools/components";
import { ThreadListSidePanel } from "./components/features/threads";
import { MemorySidebar } from "./components/features/memory";
import { ReminderPanel } from "./components/features/reminders";
import { OnboardingScreen } from "./components/features/onboarding";
import { AudioLinesIcon } from "./components/shared/icons";
import { VoiceModeUI } from "./components/features/voice";
import { VoiceRecordingPill } from "./components/shared/inputs";
import { ContextWarning } from "./components/features/chat/context/ContextWarning";
import { ErrorToast } from "./components/shared/notifications";
import type { VoiceInputHandle } from "./audio/VoiceInput";
import { WindowVisibilityProvider } from "./contexts/WindowVisibilityContext";
import { DocumentProvider } from "./contexts/documentContext";
import { initializeNotificationSound } from "./utils/soundNotification";

// Styles
import "./styles/features/copilot/index.css";
import "./styles/features/mcp/index.css";
import "./styles/features/memory/index.css";
import "./styles/features/mentions/index.css";
import "./styles/features/threads/index.css";
import "./styles/features/reminders/index.css";
import "./styles/features/workflows/index.css";
import "./styles/components/voice-recording-pill.css";
import "./styles/features/onboarding/index.css";
import "./styles/components/local-banner.css";
import "./styles/components/model-download-toast.css";
import "./styles/components/continue-button.css";
import "./styles/components/context-indicator.css";
import "./styles/components/context-warning.css";
import "./styles/components/error-toast.css";
import "./sidepanel.css";

// Core functionality
import { createLogger } from "./logger";
import { useRegisterAllActions } from "./actions/registerAll";
import { useRegisterAllWorkflows } from "./workflows/registerAll";
import { useAIChat } from "./ai/hooks";

// Custom hooks
import { useApiKey } from "./hooks/useApiKey";
import { useOnboarding } from "./hooks/useOnboarding";
import { useVoiceRecording } from "./hooks/useVoiceRecording";
import { useThreadManagement } from "./hooks/useThreadManagement";
import { useMessageHandlers } from "./hooks/useMessageHandlers";
import { useAIChatMessages } from "./hooks/useAIChatMessages";
import { useActiveTabDetection } from "./hooks/useActiveTabDetection";
import type { LocalPdfInfo } from "./hooks/useActiveTabDetection";

// Types
import type { ChatMode, ContextWarningState } from "./types/sidepanel";
import type { FileAttachmentData } from "./components/features/chat/components/FileAttachment";

// Utils
import { handleAPIError } from "./utils/apiErrorHandler";

/**
 * Inner component that uses AI SDK v5
 * Uses custom ChromeExtensionTransport for service worker communication
 */
function AIChatContent() {
    const log = createLogger("SidePanel-AI-SDK");

    // Register actions and workflows
    useRegisterAllActions();
    useRegisterAllWorkflows();

    // UI State
    const [input, setInput] = useState('');
    const [showMcp, setShowMcp] = useState(false);
    const [showThreads, setShowThreads] = useState(false);
    const [showMemory, setShowMemory] = useState(false);
    const [showReminders, setShowReminders] = useState(false);
    const [showTroubleshooting, setShowTroubleshooting] = useState(false);
    const [showFeatures, setShowFeatures] = useState(false);
    const [showProviderSetup, setShowProviderSetup] = useState(false);
    const [mode, setMode] = useState<ChatMode>('text');
    const [contextWarning, setContextWarning] = useState<ContextWarningState | null>(null);
    const [errorToast, setErrorToast] = useState<{ message: string; details?: string } | null>(null);
    const [lastBrowserError, setLastBrowserError] = useState<number | null>(null);
    const [isSoundInitialized, setIsSoundInitialized] = useState(false);
    const [localPdfInfo, setLocalPdfInfo] = useState<LocalPdfInfo | null>(null);
    const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const voiceInputRef = useRef<VoiceInputHandle>(null);

    // Custom hooks for separated concerns
    const apiKey = useApiKey();

    // Detect active tab for local PDF auto-attach feature
    const activeTabDetection = useActiveTabDetection();

    const {
        showOnboarding,
        showChatInterface,
        setShowOnboarding,
        setShowChatInterface,
        handleOnboardingComplete,
        handleOnboardingSkip,
        resetOnboarding,
    } = useOnboarding();

    const {
        isRecording,
        showPill,
        audioLinesIconRef,
        handleRecordingChange,
    } = useVoiceRecording();

    // Initialize state for thread management
    const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);

    // Initialize message persistence with proper threadId
    const { handleFinish } = useAIChatMessages({
        currentThreadId,
        onContextWarning: (percent) => {
            log.warn('Context limit warning triggered', { percent });
            setContextWarning({
                percent,
                isNearLimit: percent >= 80,
                tokensUsed: 0, // These will be updated by the AI chat hook
                tokensLimit: 0
            });
            const dismissTimeout = percent >= 95 ? 15000 : 10000;
            setTimeout(() => setContextWarning(null), dismissTimeout);
        },
    });

    // Use AI SDK v5 chat hook
    const aiChat = useAIChat({
        threadId: currentThreadId || 'default',
        onError: (error) => {
            // Add defensive null check
            if (!error) {
                log.error('AI Chat error - received null/undefined error!');
                return;
            }

            // Log full error details including complete stack trace
            log.error('AI Chat error', {
                error,
                name: error?.name,
                message: error?.message,
                stack: error?.stack,
                errorCode: (error as any)?.errorCode,
                statusCode: (error as any)?.statusCode,
                fullError: error
            });

            // Handle API errors and show error toast if needed
            if (error instanceof Error) {
                const errorObj = error as any;

                // First, check if this is a stream processing error that should be suppressed
                const isStreamProcessingError =
                    error.message?.includes('Cannot read properties') ||
                    error.message?.includes('Cannot access') ||
                    error.message?.includes('is not defined') ||
                    error.message?.includes('is undefined');

                // If we recently had a known API error (within 5 seconds), ignore stream processing errors
                if (lastBrowserError && (Date.now() - lastBrowserError) < 5000 && isStreamProcessingError) {
                    log.info('✅ SUPPRESSED: Stream processing error that occurred after known API error', {
                        message: error.message,
                        errorCode: errorObj?.errorCode,
                        timeSinceBrowserError: Date.now() - lastBrowserError
                    });
                    return; // Suppress this error completely
                }

                // If this is a BrowserAPIError OR API auth error, track it to avoid showing subsequent TypeErrors
                const isKnownAPIError = errorObj?.errorCode?.includes('BROWSER_AI') ||
                    errorObj?.errorCode === 'API_AUTH_FAILED' ||
                    errorObj?.errorCode === 'API_RATE_LIMIT' ||
                    errorObj?.errorCode === 'API_QUOTA_EXCEEDED';

                if (isKnownAPIError) {
                    log.info('🔴 Known API error detected - setting timestamp and showing toast', {
                        errorCode: errorObj?.errorCode,
                        message: error.message
                    });
                    setLastBrowserError(Date.now());

                    // Show the error toast
                    const errorToastState = handleAPIError(error);
                    if (errorToastState) {
                        log.info('📢 Setting error toast state:', errorToastState.message.substring(0, 100));
                        setErrorToast(errorToastState);
                    } else {
                        log.warn('⚠️ handleAPIError returned null for known API error');
                    }
                    return;
                }

                // Clear the error timestamp after 5 seconds
                if (lastBrowserError && (Date.now() - lastBrowserError) >= 5000) {
                    log.info('Clearing API error timestamp');
                    setLastBrowserError(null);
                }

                // Handle other API errors normally
                log.info('Handling other error type:', {
                    errorCode: errorObj?.errorCode,
                    message: error.message?.substring(0, 100)
                });
                const errorToastState = handleAPIError(error);
                if (errorToastState) {
                    log.info('📢 Setting error toast state for other error:', errorToastState.message.substring(0, 100));
                    setErrorToast(errorToastState);
                } else {
                    log.info('ℹ️ No toast to show for this error (might be suppressed)');
                }
            }
        },
        onContextWarning: (percent) => {
            log.warn('Context limit warning triggered', { percent });
            setContextWarning({
                percent,
                isNearLimit: percent >= 80,
                tokensUsed: 0, // These will be updated by the AI chat hook
                tokensLimit: 0
            });
            const dismissTimeout = percent >= 95 ? 15000 : 10000;
            setTimeout(() => setContextWarning(null), dismissTimeout);
        },
        onFinish: handleFinish,
    });

    const {
        messages,
        sendMessage,
        status,
        stop,
        setMessages,
        usage,
        resetUsage,
        setUsage,
    } = aiChat;

    const isLoading = status === 'submitted' || status === 'streaming';

    // Thread management hook - now has access to all functions including setUsage
    const {
        currentThreadId: managedThreadId,
        handleNewThread,
        handleThreadSelect,
        handleClearChat,
    } = useThreadManagement({
        setMessages,
        setContextWarning,
        resetUsage,
        setUsage,
    });

    // Sync managed thread ID with local state
    useEffect(() => {
        if (managedThreadId) {
            setCurrentThreadId(managedThreadId);
        }
    }, [managedThreadId]);

    // Update local PDF info when active tab changes
    useEffect(() => {
        if (activeTabDetection.isLocalPdf && activeTabDetection.filename && activeTabDetection.filePath) {
            log.info('Local PDF detected in active tab', {
                filename: activeTabDetection.filename,
                filePath: activeTabDetection.filePath,
            });
            setLocalPdfInfo({
                url: activeTabDetection.url || '',
                filename: activeTabDetection.filename,
                filePath: activeTabDetection.filePath,
            });
        } else {
            // Clear state when tab is not a local PDF
            if (localPdfInfo) {
                log.debug('Clearing local PDF info - tab is not a local PDF');
                setLocalPdfInfo(null);
            }
        }
    }, [activeTabDetection.isLocalPdf, activeTabDetection.filename, activeTabDetection.filePath, activeTabDetection.url]);

    // Message handlers
    const { handleSendMessage: handleSend } = useMessageHandlers({
        messages,
        currentThreadId,
        isLoading,
        sendMessage,
        onError: (message: string) => {
            setErrorToast({ message });
        },
    });

    // Wrapper for handleSendMessage to work with input state
    const handleSendMessage = async (messageText?: string, attachments?: FileAttachmentData[], workflowId?: string) => {
        await handleSend(messageText !== undefined ? messageText : input, attachments, workflowId);
        if (messageText === undefined) {
            setInput(''); // Only clear if using input state
        }
    };

    // Expose test functions globally
    useEffect(() => {
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
    }, [resetOnboarding, setShowOnboarding, setShowChatInterface]);

    // Initialize notification sound on first user interaction
    useEffect(() => {
        if (isSoundInitialized) return;

        const initSound = async () => {
            try {
                await initializeNotificationSound();
                setIsSoundInitialized(true);
                log.info('Notification sound initialized');
            } catch (error) {
                log.warn('Failed to initialize notification sound:', error);
            }
        };

        // Initialize on any user interaction (click, keypress, focus)
        const handleUserInteraction = () => {
            initSound();
            // Remove listeners after first interaction
            document.removeEventListener('click', handleUserInteraction);
            document.removeEventListener('keypress', handleUserInteraction);
            window.removeEventListener('focus', handleUserInteraction);
        };

        document.addEventListener('click', handleUserInteraction);
        document.addEventListener('keypress', handleUserInteraction);
        window.addEventListener('focus', handleUserInteraction);

        return () => {
            document.removeEventListener('click', handleUserInteraction);
            document.removeEventListener('keypress', handleUserInteraction);
            window.removeEventListener('focus', handleUserInteraction);
        };
    }, [isSoundInitialized]);

    // Listen for image preview state changes to hide voice pill
    useEffect(() => {
        const handleImagePreviewStateChange = (event: CustomEvent) => {
            setIsImagePreviewOpen(event.detail.isOpen);
        };

        window.addEventListener('imagePreviewStateChange' as any, handleImagePreviewStateChange);
        return () => {
            window.removeEventListener('imagePreviewStateChange' as any, handleImagePreviewStateChange);
        };
    }, []);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        log.debug("Messages changed", { count: messages.length });
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (input.trim().length > 0) {
                handleSendMessage();
            }
        }
    };

    // Handle continue button click
    const handleContinue = () => {
        log.info("Continue button clicked - sending continue message");
        sendMessage({
            text: "Please continue from where you left off. Complete any remaining tasks or tool calls that were interrupted by the step limit."
        });
    };

    // Phase 4: Listen for notification actions and omnibox messages from background
    useEffect(() => {
        const handleBackgroundMessage = async (
            message: any,
            _sender: chrome.runtime.MessageSender,
            sendResponse: (response?: any) => void
        ) => {
            // Handle omnibox messages
            if (message?.type === 'omnibox/send-message') {
                const { text } = message.payload;

                log.info('🔤 Received omnibox message', { text, hasThread: !!currentThreadId });

                // If no thread exists, create a new one
                if (!currentThreadId) {
                    log.info('📝 Creating new thread for omnibox message');
                    await handleNewThread();
                    // Wait a bit for the thread to be created
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                // Send the message
                if (text && text.trim()) {
                    log.info('📤 Sending omnibox message to chat');
                    await handleSendMessage(text.trim());
                }

                sendResponse({ success: true });
                return true;
            }

            // Handle notification actions
            if (message?.type === 'ai/notification/action') {
                const { action, threadId } = message.payload;

                log.info('📬 Received notification action from background', { action, threadId });

                if (action === 'continue') {
                    // Load the correct thread if not already active
                    if (threadId && threadId !== currentThreadId) {
                        log.info('🔄 Switching to thread from notification', {
                            from: currentThreadId,
                            to: threadId
                        });
                        await handleThreadSelect(threadId);

                        // Wait a bit for the thread to load
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }

                    // Trigger the continue action
                    log.info('▶️ Triggering continue action from notification');
                    handleContinue();

                    // Scroll to latest message (will happen automatically via messagesEndRef)
                    // Focus happens when user starts typing

                    sendResponse({ success: true });
                    return true; // Keep message channel open for async response
                } else if (action === 'navigate' || action === 'open') {
                    // Just open to the thread (notification body click)
                    if (threadId && threadId !== currentThreadId) {
                        log.info('📂 Opening thread from notification', { threadId });
                        await handleThreadSelect(threadId);
                    }
                    sendResponse({ success: true });
                    return true; // Keep message channel open for async response
                }
            }
            return false;
        };

        chrome.runtime.onMessage.addListener(handleBackgroundMessage);

        return () => {
            chrome.runtime.onMessage.removeListener(handleBackgroundMessage);
        };
    }, [currentThreadId, handleThreadSelect, handleNewThread, handleContinue, handleSendMessage, sendMessage]);

    // Handle mode change with cleanup
    const handleModeChange = async (newMode: ChatMode) => {
        if (mode === newMode) return;

        if (isRecording) {
            log.warn('Cannot switch mode while recording');
            return;
        }

        log.info('Switching mode', { from: mode, to: newMode });
        setMode(newMode);
    };

    // Render MCP Manager or Chat Window
    if (showMcp) {
        return <McpManager onBack={() => setShowMcp(false)} />;
    }

    // Render Troubleshooting page
    if (showTroubleshooting) {
        return <Troubleshooting onBack={() => setShowTroubleshooting(false)} />;
    }

    // Render Features page
    if (showFeatures) {
        return <Features onBack={() => setShowFeatures(false)} onPromptClick={(prompt) => {
            setInput(prompt);
        }} />;
    }

    // Render Provider Setup page
    if (showProviderSetup) {
        return <ProviderSetup onBack={() => setShowProviderSetup(false)} />;
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

            {/* Error Toast Notification */}
            <ErrorToast
                message={errorToast?.message || ''}
                technicalDetails={errorToast?.details}
                isVisible={!!errorToast}
                onDismiss={() => setErrorToast(null)}
                duration={10000}
            />

            {/* Context Limit Warning */}
            {contextWarning && (
                <ContextWarning
                    percent={contextWarning.percent}
                    onDismiss={() => setContextWarning(null)}
                    onNewThread={handleNewThread}
                />
            )}

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
                    transition={{ duration: 0.25, ease: "easeOut" }}
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
                                onTroubleshootingClick={() => setShowTroubleshooting(true)}
                                onFeaturesClick={() => setShowFeatures(true)}
                                onProviderSetupClick={() => setShowProviderSetup(true)}
                                onNewThreadClick={handleNewThread}
                                onStop={stop}
                                onContinue={handleContinue}
                                isLoading={isLoading}
                                messagesEndRef={messagesEndRef}
                                isRecording={isRecording}
                                onRecordingChange={handleRecordingChange}
                                voiceInputRef={voiceInputRef}
                                usage={usage}
                                localPdfInfo={localPdfInfo}
                            />

                            {/* Floating Recording Pill - Only in text mode */}
                            <VoiceRecordingPill
                                ref={audioLinesIconRef}
                                isVisible={showPill && !isImagePreviewOpen}
                                onStopRecording={() => {
                                    // Stop the voice recording
                                    voiceInputRef.current?.stopRecording();
                                }}
                            />

                            {/* Voice Mode FAB - Only in text mode */}
                            {!isImagePreviewOpen && (
                                <motion.button
                                    className={`voice-mode-fab ${messages.length > 0 ? 'has-messages' : ''}`}
                                    onClick={() => handleModeChange('voice')}
                                    initial={{ scale: 0.93, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{
                                        type: 'spring',
                                        stiffness: 260,
                                        damping: 20,
                                        delay: 0.1
                                    }}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.97 }}
                                    title="Switch to Voice Mode"
                                >
                                    <AudioLinesIcon size={20} />
                                </motion.button>
                            )}
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
        <WindowVisibilityProvider>
            <DocumentProvider>
                <ToolUIProvider>
                    <AIChatContent />
                </ToolUIProvider>
            </DocumentProvider>
        </WindowVisibilityProvider>
    );
}

export default SidePanel;

// TypeScript declarations
declare global {
    interface Window {
        chrome: typeof chrome;
    }
}
