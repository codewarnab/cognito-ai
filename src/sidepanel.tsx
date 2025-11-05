import { useState, useRef, useEffect } from "react";
import { motion } from 'framer-motion';
import { CopilotChatWindow } from "./components/core/CopilotChatWindow";
import { McpManager } from "./components/features/mcp";
import { Troubleshooting } from "./components/features/help/Troubleshooting";
import { Features } from "./components/features/help/Features";
import { ToolUIProvider } from "./ai/tools/components";
import { ThreadListSidePanel } from "./components/features/threads";
import { MemorySidebar } from "./components/features/memory";
import { ReminderPanel } from "./components/features/reminders";
import { OnboardingScreen } from "./components/features/onboarding";
import { AudioLinesIcon } from "./components/shared/icons";
import { VoiceModeUI } from "./components/features/voice";
import { VoiceRecordingPill } from "./components/shared/inputs";
import { ContextWarning } from "./components/features/chat/context/ContextWarning";
import type { VoiceInputHandle } from "./audio/VoiceInput";

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
import "./sidepanel.css";

// Core functionality
import { createLogger } from "./logger";
import { useRegisterAllActions } from "./actions/registerAll";
import { useRegisterAllWorkflows } from "./workflows/registerAll";
import { useAIChat } from "./ai/hooks";

// Custom hooks
import { useApiKey } from "./hooks/useApiKey";
import { useOnboarding } from "./hooks/useOnboarding";
import { useTabContext } from "./hooks/useTabContext";
import { useVoiceRecording } from "./hooks/useVoiceRecording";
import { useThreadManagement } from "./hooks/useThreadManagement";
import { useMessageHandlers } from "./hooks/useMessageHandlers";
import { useBehavioralPreferences } from "./hooks/useBehavioralPreferences";
import { useAIChatMessages } from "./hooks/useAIChatMessages";

// Types
import type { ChatMode, ContextWarningState } from "./types/sidepanel";
import type { FileAttachmentData } from "./components/features/chat/components/FileAttachment";

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
    const [mode, setMode] = useState<ChatMode>('text');
    const [contextWarning, setContextWarning] = useState<ContextWarningState | null>(null);

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const voiceInputRef = useRef<VoiceInputHandle>(null);

    // Custom hooks for separated concerns
    const apiKey = useApiKey();
    const currentTab = useTabContext();
    const behavioralPreferences = useBehavioralPreferences();

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
            setContextWarning({ percent });
            const dismissTimeout = percent >= 95 ? 15000 : 10000;
            setTimeout(() => setContextWarning(null), dismissTimeout);
        },
    });

    // Use AI SDK v5 chat hook
    const aiChat = useAIChat({
        threadId: currentThreadId || 'default',
        onError: (error) => {
            log.error('AI Chat error', error);
        },
        onContextWarning: (percent) => {
            log.warn('Context limit warning triggered', { percent });
            setContextWarning({ percent });
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
    } = aiChat;

    const isLoading = status === 'submitted' || status === 'streaming';

    // Thread management hook - now has access to all functions
    const {
        currentThreadId: managedThreadId,
        handleNewThread,
        handleThreadSelect,
        handleClearChat,
    } = useThreadManagement({
        setMessages,
        setContextWarning,
        resetUsage,
    });

    // Sync managed thread ID with local state
    useEffect(() => {
        if (managedThreadId) {
            setCurrentThreadId(managedThreadId);
        }
    }, [managedThreadId]);

    // Message handlers
    const { handleSendMessage: handleSend } = useMessageHandlers({
        messages,
        currentThreadId,
        isLoading,
        sendMessage,
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
                                onTroubleshootingClick={() => setShowTroubleshooting(true)}
                                onFeaturesClick={() => setShowFeatures(true)}
                                onNewThreadClick={handleNewThread}
                                onStop={stop}
                                onContinue={handleContinue}
                                isLoading={isLoading}
                                messagesEndRef={messagesEndRef}
                                isRecording={isRecording}
                                onRecordingChange={handleRecordingChange}
                                voiceInputRef={voiceInputRef}
                                usage={usage}
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
