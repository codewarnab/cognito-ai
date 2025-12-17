/**
 * WXT Sidepanel App Component
 * 
 * Migrated from src/sidepanel.tsx
 * Contains the main side panel UI logic including:
 * - AI Chat interface with AI SDK v5
 * - Thread management
 * - Voice mode
 * - MCP Manager
 * - Settings and onboarding flows
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from 'framer-motion';

// UI Components
import { CopilotChatWindow } from "@/components/shell";
import { McpManager } from "@/components/features/mcp";
import { Troubleshooting } from "@/components/features/help/Troubleshooting";
import { Features } from "@/components/features/help/Features";
import { ProviderSetup } from "@/components/features/help/ProviderSetup";
import { ToolUIProvider } from "@/ai/tools/components";
import { ThreadListSidePanel } from "@/components/features/threads";
import { ReminderPanel } from "@/components/features/reminders";
import { SettingsPage } from "@/components/features/settings/SettingsPage";
import { LoggerPanel } from "@/components/features/settings/LoggerPanel";
import { OnboardingScreen } from "@/components/features/onboarding";
import { AudioLinesIcon } from "@/components/shared/icons";
import { VoiceModeUI } from "@/components/features/voice";
import { VoiceRecordingPill } from "@/components/shared/inputs";
import { ContextWarning } from "@/components/features/chat/context/ContextWarning";
import { ErrorToast } from "@/components/shared/notifications";

// Types
import type { VoiceInputHandle } from "@/audio/VoiceInput";
import type { ContextWarningState } from "@/types/sidepanel";
import type { FileAttachmentData, TabAttachmentData } from "@/components/features/chat/components/attachments";

// Contexts
import { WindowVisibilityProvider } from "@/contexts/WindowVisibilityContext";

// Stores
import { useUINavigationStore, useChatStore, useModelStore, useVoiceModeStore, useToolsStore, type ChatState, type ModelState, type VoiceModeState, type ToolsState } from "@/stores";

// Core functionality
import { createLogger } from '~logger';
import { useRegisterAllActions } from "@/actions/registerAll";
import { useRegisterAllWorkflows } from "@/workflows/registerAll";
import { useAIChat } from "@/ai/hooks";

// Custom hooks
import { useOnboarding } from "@/hooks/settings";
import { useMessageHandlers, useAIChatMessages } from "@/hooks/chat";
import { useActiveTabDetection } from "@/hooks/browser";
import type { LocalPdfInfo } from "@/hooks/browser";

// Sidepanel-specific hooks
import {
    useNotificationSound,
    useBackgroundMessageListener,
    useImagePreviewListener,
    useOnboardingTestHandles,
} from "@/hooks/sidepanel";

// Sandbox initialization hook
import { useSandbox } from "@/hooks/sandbox";

// Utils
import { handleAPIError } from "@/utils/errors";

/**
 * Inner component that uses AI SDK v5
 */
function AIChatContent() {
    const log = createLogger("SidePanel-AI-SDK");

    // Register actions and workflows
    useRegisterAllActions();
    useRegisterAllWorkflows();

    // Initialize sandbox bridge for adaptive mode code execution
    const { isReady: isSandboxReady, error: sandboxError } = useSandbox();
    if (sandboxError) {
        log.warn('Sandbox initialization failed:', sandboxError);
    } else if (isSandboxReady) {
        log.debug('Sandbox is ready for code execution');
    }

    // UI Navigation Store
    const {
        activePanel,
        navigateTo,
        isThreadsPanelOpen,
        isRemindersPanelOpen,
        openOverlay,
        closeOverlay,
        chatMode,
        setChatMode,
        isVoiceFabVisible,
        showChatInterface,
        setShowChatInterface,
    } = useUINavigationStore();

    // Chat Store - centralized chat state
    const storeInput = useChatStore((state: ChatState) => state.input);
    const setStoreInput = useChatStore((state: ChatState) => state.setInput);
    const storeErrorToast = useChatStore((state: ChatState) => state.errorToast);
    const showStoreErrorToast = useChatStore((state: ChatState) => state.showErrorToast);
    const dismissStoreErrorToast = useChatStore((state: ChatState) => state.dismissErrorToast);
    const storeCurrentThreadId = useChatStore((state: ChatState) => state.currentThreadId);
    const initializeChatStore = useChatStore((state: ChatState) => state.initialize);
    const createNewThread = useChatStore((state: ChatState) => state.createNewThread);
    const selectThread = useChatStore((state: ChatState) => state.selectThread);
    const clearChat = useChatStore((state: ChatState) => state.clearChat);
    const storeMessages = useChatStore((state: ChatState) => state.messages);
    const storeUsage = useChatStore((state: ChatState) => state.usage);

    // Model Store - initialize on mount
    const initializeModelStore = useModelStore((state: ModelState) => state.initialize);

    // Tools Store - initialize on mount for accurate tool counts
    const initializeToolsStore = useToolsStore((state: ToolsState) => state.initialize);

    // Local UI state (transient - not persisted)
    const [contextWarning, setContextWarning] = useState<ContextWarningState | null>(null);
    const [lastBrowserError, setLastBrowserError] = useState<number | null>(null);
    const [localPdfInfo, setLocalPdfInfo] = useState<LocalPdfInfo | null>(null);

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const voiceInputRef = useRef<VoiceInputHandle>(null);

    // Detect active tab for local PDF auto-attach feature
    const activeTabDetection = useActiveTabDetection();

    const {
        showOnboarding,
        setShowOnboarding,
        handleOnboardingComplete,
        handleOnboardingSkip,
        resetOnboarding,
    } = useOnboarding();

    // Voice Mode Store - replaces useVoiceRecording hook
    const isRecording = useVoiceModeStore((state: VoiceModeState) => state.isRecording);
    const showPill = useVoiceModeStore((state: VoiceModeState) => state.showRecordingPill);
    const handleRecordingChange = useVoiceModeStore((state: VoiceModeState) => state.handleRecordingChange);

    // Initialize notification sound
    useNotificationSound();

    // Listen for image preview state changes
    const { isImagePreviewOpen } = useImagePreviewListener();

    // Initialize stores on mount
    useEffect(() => {
        initializeChatStore();
        initializeModelStore();
        initializeToolsStore();
    }, [initializeChatStore, initializeModelStore, initializeToolsStore]);

    // Use thread ID from store
    const currentThreadId = storeCurrentThreadId;

    // Initialize message persistence with proper threadId
    const { handleFinish } = useAIChatMessages({
        currentThreadId,
        onContextWarning: (percent) => {
            log.warn('Context limit warning triggered', { percent });
            setContextWarning({
                percent,
                isNearLimit: percent >= 80,
                tokensUsed: 0,
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
            if (!error) {
                log.error('AI Chat error - received null/undefined error!');
                return;
            }

            log.error('AI Chat error', {
                error,
                name: error?.name,
                message: error?.message,
                stack: error?.stack,
                errorCode: (error as any)?.errorCode,
                statusCode: (error as any)?.statusCode,
                fullError: error
            });

            if (error instanceof Error) {
                const errorObj = error as any;

                const isStreamProcessingError =
                    error.message?.includes('Cannot read properties') ||
                    error.message?.includes('Cannot access') ||
                    error.message?.includes('is not defined') ||
                    error.message?.includes('is undefined');

                if (lastBrowserError && (Date.now() - lastBrowserError) < 5000 && isStreamProcessingError) {
                    log.info('✅ SUPPRESSED: Stream processing error that occurred after known API error', {
                        message: error.message,
                        errorCode: errorObj?.errorCode,
                        timeSinceBrowserError: Date.now() - lastBrowserError
                    });
                    return;
                }

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

                    const errorToastState = handleAPIError(error);
                    if (errorToastState) {
                        log.info('📢 Setting error toast state:', errorToastState.message.substring(0, 100));
                        showStoreErrorToast(errorToastState.message, errorToastState.details);
                    }
                    return;
                }

                if (lastBrowserError && (Date.now() - lastBrowserError) >= 5000) {
                    log.info('Clearing API error timestamp');
                    setLastBrowserError(null);
                }

                log.info('Handling other error type:', {
                    errorCode: errorObj?.errorCode,
                    message: error.message?.substring(0, 100)
                });
                const errorToastState = handleAPIError(error);
                if (errorToastState) {
                    log.info('📢 Setting error toast state for other error:', errorToastState.message.substring(0, 100));
                    showStoreErrorToast(errorToastState.message, errorToastState.details);
                }
            }
        },
        onContextWarning: (percent) => {
            log.warn('Context limit warning triggered', { percent });
            setContextWarning({
                percent,
                isNearLimit: percent >= 80,
                tokensUsed: 0,
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
        usage,
    } = aiChat;

    const isLoading = status === 'submitted' || status === 'streaming';

    // Thread management using store actions
    const handleNewThread = useCallback(async (forceCreate: boolean = false) => {
        try {
            // Check if current thread is already empty (skip if forceCreate)
            if (!forceCreate && storeMessages.length === 0) {
                log.info("Current thread is already empty, skipping new thread creation");
                return;
            }

            await createNewThread();
            setContextWarning(null);
            log.info("✨ Created new thread via store");
        } catch (error) {
            log.error("Failed to create new thread", error);
        }
    }, [createNewThread, storeMessages.length]);

    const handleThreadSelect = useCallback(async (threadId: string) => {
        log.info("🔄 Switching to thread via store", { threadId });
        setContextWarning(null);
        await selectThread(threadId);
    }, [selectThread]);

    const handleClearChat = useCallback(async () => {
        if (!currentThreadId) return;

        if (window.confirm('Are you sure you want to clear the chat history for this thread?')) {
            try {
                log.info("Clearing thread messages via store", { threadId: currentThreadId });
                await clearChat();
                log.info("Thread messages cleared successfully");
            } catch (error) {
                log.error("Failed to clear thread messages", error);
            }
        }
    }, [currentThreadId, clearChat]);

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
            showStoreErrorToast(message);
        },
    });

    // Handle send message
    const handleSendMessage = useCallback(async (
        messageText?: string,
        attachments?: FileAttachmentData[],
        tabAttachments?: TabAttachmentData[],
        workflowId?: string
    ) => {
        await handleSend(messageText !== undefined ? messageText : storeInput, attachments, tabAttachments, workflowId);
        if (messageText === undefined) {
            setStoreInput('');
        }
    }, [handleSend, storeInput, setStoreInput]);

    // Handle key press for sending messages
    const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (storeInput.trim().length > 0) {
                handleSendMessage();
            }
        }
    }, [storeInput, handleSendMessage]);

    // Handle continue button click
    const handleContinue = useCallback(() => {
        log.info("Continue button clicked - sending continue message");
        sendMessage({
            text: "Please continue from where you left off. Complete any remaining tasks or tool calls that were interrupted by the step limit."
        });
    }, [sendMessage]);

    // Handle mode change
    const handleModeChange = useCallback(async (newMode: 'text' | 'voice') => {
        if (chatMode === newMode) return;

        if (isRecording) {
            log.warn('Cannot switch mode while recording');
            return;
        }

        log.info('Switching mode', { from: chatMode, to: newMode });
        setChatMode(newMode);
    }, [chatMode, isRecording, setChatMode]);

    // Expose test functions globally
    useOnboardingTestHandles({
        resetOnboarding,
        setShowOnboarding,
        setShowChatInterface,
    });

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        log.debug("Messages changed", { count: messages.length });
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Listen for background messages
    useBackgroundMessageListener({
        currentThreadId,
        handleNewThread,
        handleThreadSelect,
        handleSendMessage,
        handleContinue,
        sendMessage,
    });

    // Keyboard shortcut: Ctrl+N for new chat
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                if (!isLoading) {
                    log.info('Ctrl+N pressed - creating new thread');
                    handleNewThread();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isLoading, handleNewThread]);

    // Render based on active panel
    if (activePanel === 'mcp') {
        return <McpManager onBack={() => navigateTo('chat')} />;
    }

    if (activePanel === 'troubleshooting') {
        return <Troubleshooting onBack={() => navigateTo('chat')} />;
    }

    if (activePanel === 'features') {
        return <Features onBack={() => navigateTo('chat')} onPromptClick={(prompt) => {
            setStoreInput(prompt);
            navigateTo('chat');
        }} />;
    }

    if (activePanel === 'providerSetup') {
        return <ProviderSetup onBack={() => navigateTo('chat')} />;
    }

    if (activePanel === 'settings') {
        return (
            <SettingsPage
                onBack={() => navigateTo('chat')}
                onProviderSetupClick={() => navigateTo('providerSetup')}
            />
        );
    }

    if (activePanel === 'loggerPanel') {
        return <LoggerPanel onBack={() => navigateTo('chat')} />;
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

    // Only render chat interface when visible
    if (!showChatInterface) {
        return null;
    }

    return (
        <>
            {/* Error Toast Notification */}
            <ErrorToast
                message={storeErrorToast?.message || ''}
                technicalDetails={storeErrorToast?.details}
                isVisible={!!storeErrorToast}
                onDismiss={dismissStoreErrorToast}
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

            {/* Reminder Panel - Side panel overlay */}
            <ReminderPanel isOpen={isRemindersPanelOpen} onClose={() => closeOverlay('reminders')} />

            {/* Thread List Side Panel */}
            <ThreadListSidePanel
                isOpen={isThreadsPanelOpen}
                onClose={() => closeOverlay('threads')}
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
                    {chatMode === 'text' ? (
                        <>
                            <CopilotChatWindow
                                messages={messages.filter(m => m.role !== 'system') as any}
                                input={storeInput}
                                setInput={setStoreInput}
                                onSendMessage={handleSendMessage}
                                onKeyDown={handleKeyPress}
                                onClearChat={handleClearChat}
                                onSettingsClick={() => navigateTo('mcp')}
                                onGeneralSettingsClick={() => navigateTo('settings')}
                                onThreadsClick={() => openOverlay('threads')}
                                onRemindersClick={() => openOverlay('reminders')}
                                onTroubleshootingClick={() => navigateTo('troubleshooting')}
                                onFeaturesClick={() => navigateTo('features')}
                                onProviderSetupClick={() => navigateTo('providerSetup')}
                                onLoggerPanelClick={() => navigateTo('loggerPanel')}
                                onNewThreadClick={handleNewThread}
                                onStop={stop}
                                onContinue={handleContinue}
                                isLoading={isLoading}
                                messagesEndRef={messagesEndRef}
                                isRecording={isRecording}
                                onRecordingChange={handleRecordingChange}
                                voiceInputRef={voiceInputRef}
                                usage={storeUsage || usage}
                                localPdfInfo={localPdfInfo}
                                threadId={currentThreadId}
                            />

                            {/* Floating Recording Pill - Only in text mode */}
                            <VoiceRecordingPill
                                isVisible={showPill && !isImagePreviewOpen}
                                onStopRecording={() => {
                                    voiceInputRef.current?.stopRecording();
                                }}
                            />

                            {/* Voice Mode FAB - Only in text mode */}
                            {!isImagePreviewOpen && isVoiceFabVisible && (
                                <motion.button
                                    className={`fixed bottom-[120px] right-4 w-[44px] h-11 rounded-full 
                                        bg-white/5 border border-white/10 text-white/60 
                                        cursor-pointer z-[998] flex items-center justify-center 
                                        backdrop-blur-[10px] transition-all duration-200 ease-out
                                        hover:bg-white/10 hover:text-white/90 hover:border-white/20
                                        active:scale-97
                                        ${messages.length > 0 ? 'opacity-20 hover:opacity-100' : ''}`}
                                    onClick={() => handleModeChange('voice')}
                                    initial={{ scale: 0.93, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{
                                        type: 'spring',
                                        stiffness: 260,
                                        damping: 20,
                                        delay: 0.1
                                    }}
                                    id="voice-mode-fab"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.97 }}
                                    title="Switch to Voice Mode"
                                >
                                    <AudioLinesIcon size={20} />
                                </motion.button>
                            )}
                        </>
                    ) : (
                        <VoiceModeUI onBack={() => setChatMode('text')} />
                    )}
                </motion.div>
            )}
        </>
    );
}

/**
 * Main App component for WXT sidepanel
 */
function App() {
    return (
        <WindowVisibilityProvider>
                <ToolUIProvider>
                    <AIChatContent />
                </ToolUIProvider>
        </WindowVisibilityProvider>
    );
}

export default App;
