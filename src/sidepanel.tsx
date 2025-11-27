import "./polyfills/process";
import { useState, useRef, useEffect } from "react";
import { motion } from 'framer-motion';
import { CopilotChatWindow } from "@/components/shell";
import { McpManager } from "@/components/features/mcp";
import { Troubleshooting } from "@/components/features/help/Troubleshooting";
import { Features } from "@/components/features/help/Features";
import { ProviderSetup } from "@/components/features/help/ProviderSetup";
import { ToolUIProvider } from "./ai/tools/components";
import { ThreadListSidePanel } from "@/components/features/threads";
import { ReminderPanel } from "@/components/features/reminders";
import { SettingsPage } from "@/components/features/settings/SettingsPage";
import { OnboardingScreen } from "@/components/features/onboarding";
import { AudioLinesIcon } from "@/components/shared/icons";
import { VoiceModeUI } from "@/components/features/voice";
import { VoiceRecordingPill } from "@/components/shared/inputs";
import { ContextWarning } from "@/components/features/chat/context/ContextWarning";
import { ErrorToast } from "@/components/shared/notifications";
import type { VoiceInputHandle } from "./audio/VoiceInput";
import { WindowVisibilityProvider } from "./contexts/WindowVisibilityContext";
import { DocumentProvider } from "./contexts/documentContext";

// Styles
import "./styles/features/copilot/index.css";
import "./styles/features/mcp/index.css";
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
import "./styles/components/streaming-warning.css";
import "./styles/components/error-toast.css";
import "./sidepanel.css";

// Core functionality
import { createLogger } from '~logger';
import { useRegisterAllActions } from "./actions/registerAll";
import { useRegisterAllWorkflows } from "./workflows/registerAll";
import { useAIChat } from "./ai/hooks";

// Custom hooks
import { useApiKey, useOnboarding } from "./hooks/settings";
import { useVoiceRecording } from "./hooks/ui";
import { useThreadManagement, useMessageHandlers, useAIChatMessages } from "./hooks/chat";
import { useActiveTabDetection } from "./hooks/browser";
import type { LocalPdfInfo } from "./hooks/browser";

// Sidepanel-specific hooks
import {
    useSidepanelUiState,
    useNotificationSound,
    useBackgroundMessageListener,
    useImagePreviewListener,
    useOnboardingTestHandles,
} from "./hooks/sidepanel";

// Types
import type { ContextWarningState } from "./types/sidepanel";
import type { FileAttachmentData } from "@/components/features/chat/components/attachments";
import type { TabAttachmentData } from "@/components/features/chat/components/attachments";

// Utils
import { handleAPIError } from "@/utils/errors";

/**
 * Inner component that uses AI SDK v5
 * Uses custom ChromeExtensionTransport for service worker communication
 */
function AIChatContent() {
    const log = createLogger("SidePanel-AI-SDK");

    // Register actions and workflows
    useRegisterAllActions();
    useRegisterAllWorkflows();

    // UI State - other states not managed by the hook
    const [contextWarning, setContextWarning] = useState<ContextWarningState | null>(null);
    const [errorToast, setErrorToast] = useState<{ message: string; details?: string } | null>(null);
    const [lastBrowserError, setLastBrowserError] = useState<number | null>(null);
    const [localPdfInfo, setLocalPdfInfo] = useState<LocalPdfInfo | null>(null);

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

    // Initialize notification sound
    useNotificationSound();

    // Listen for image preview state changes
    const { isImagePreviewOpen } = useImagePreviewListener();

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
    // Note: This needs to be defined before uiState hook since the hook needs it
    const handleSendMessageWithInput = async (messageText?: string, attachments?: FileAttachmentData[], tabAttachments?: TabAttachmentData[], workflowId?: string, inputValue?: string) => {
        await handleSend(messageText !== undefined ? messageText : (inputValue || ''), attachments, tabAttachments, workflowId);
    };

    // UI State hook
    const {
        input,
        setInput,
        showMcp,
        setShowMcp,
        showSettings,
        setShowSettings,
        showThreads,
        setShowThreads,
        showReminders,
        setShowReminders,
        showTroubleshooting,
        setShowTroubleshooting,
        showFeatures,
        setShowFeatures,
        showProviderSetup,
        setShowProviderSetup,
        mode,
        setMode,
        handleModeChange,
        handleKeyPress,
        handleContinue,
    } = useSidepanelUiState({
        isRecording,
        onSendMessage: () => handleSendMessageWithInput(undefined, undefined, undefined, undefined, input),
        sendMessage,
    });

    // Wrapper for handleSendMessage to work with input state
    const handleSendMessage = async (messageText?: string, attachments?: FileAttachmentData[], tabAttachments?: TabAttachmentData[], workflowId?: string) => {
        await handleSendMessageWithInput(messageText, attachments, tabAttachments, workflowId, input);
        if (messageText === undefined) {
            setInput(''); // Only clear if using input state
        }
    };

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

    // Listen for background messages (omnibox and notifications)
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
            // Check for Ctrl+N (or Cmd+N on Mac)
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault(); // Prevent browser's default new window behavior

                // Only trigger if not currently loading
                if (!isLoading) {
                    log.info('Ctrl+N pressed - creating new thread');
                    handleNewThread();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isLoading, handleNewThread]);

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

    // Render Settings page
    if (showSettings) {
        return (
            <SettingsPage
                onBack={() => setShowSettings(false)}
                onProviderSetupClick={() => {
                    setShowSettings(false);
                    setShowProviderSetup(true);
                }}
            />
        );
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
                                onGeneralSettingsClick={() => setShowSettings(true)}
                                onThreadsClick={() => setShowThreads(true)}
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

