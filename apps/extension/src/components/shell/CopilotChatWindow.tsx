import React, { useEffect } from 'react';
import { ChatHeader } from '@/components/features/chat/components/display';
import { ChatMessages } from '@/components/features/chat/components/display';
import { ChatInput } from '@/components/features/chat/components/composer';
import { ErrorNotification } from '@/components/features/chat/components/feedback';
import { ModelDownloadToastContainer } from '@/components/shared/notifications';
import type { VoiceInputHandle } from '@/audio/VoiceInput';
import { ENV } from '@/utils/env';
import type { Message, AIMode, RemoteModelType } from '@/components/features/chat/types';
import type { AppUsage } from '@/ai/types/usage';
import type { LocalPdfInfo } from '@/hooks/browser';
import { clearAllDismissals } from '@/utils/settings';
import { useModelStore, useSettingsStore, type ModelState as StoreModelState } from '@/stores';

interface CopilotChatWindowProps {
    messages: Message[];
    input: string;
    setInput: (value: string) => void;
    onSendMessage: (messageText?: string, attachments?: any[], tabAttachments?: any[], workflowId?: string) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onClearChat: () => void;
    isLoading: boolean;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    onSettingsClick?: () => void;
    onGeneralSettingsClick?: () => void;
    onThreadsClick?: () => void;
    onNewThreadClick?: (forceCreate?: boolean) => void;
    onTroubleshootingClick?: () => void;
    onFeaturesClick?: () => void;
    onProviderSetupClick?: () => void;
    onLoggerPanelClick?: () => void;
    onStop?: () => void;
    pendingMessageId?: string | null;
    nextMessageId?: string;
    isRecording?: boolean;
    onRecordingChange?: (isRecording: boolean) => void;
    voiceInputRef?: React.RefObject<VoiceInputHandle | null>;
    onContinue?: () => void;
    onRetry?: () => void;
    usage?: AppUsage | null;
    localPdfInfo?: LocalPdfInfo | null;
    threadId?: string | null;
    addToolOutput?: (params: { tool: string; toolCallId: string; output: any }) => void; // Human-in-the-loop approval
}

export function CopilotChatWindow({
    messages,
    input,
    setInput,
    onSendMessage,
    isLoading,
    messagesEndRef,
    onSettingsClick,
    onGeneralSettingsClick,
    onThreadsClick,
    onNewThreadClick,
    onTroubleshootingClick,
    onFeaturesClick,
    onProviderSetupClick,
    onLoggerPanelClick,
    onStop,
    pendingMessageId,
    nextMessageId,
    isRecording,
    onRecordingChange,
    voiceInputRef,
    onContinue,
    onRetry,
    usage,
    localPdfInfo,
    threadId,
    addToolOutput,
}: CopilotChatWindowProps) {
    // Use Zustand stores for model and settings state
    const mode = useModelStore((state: StoreModelState) => state.mode);
    const remoteModel = useModelStore((state: StoreModelState) => state.remoteModel);
    const hasApiKey = useModelStore((state: StoreModelState) => state.hasApiKey);
    const conversationStartMode = useModelStore((state: StoreModelState) => state.conversationStartMode);
    const modelIsLoading = useModelStore((state: StoreModelState) => state.isLoading);
    const setMode = useModelStore((state: StoreModelState) => state.setMode);
    const setRemoteModel = useModelStore((state: StoreModelState) => state.setRemoteModel);
    const clearConversationStartMode = useModelStore((state: StoreModelState) => state.clearConversationStartMode);
    const initializeModel = useModelStore((state: StoreModelState) => state.initialize);
    const refreshApiKeyStatus = useModelStore((state: StoreModelState) => state.refreshApiKeyStatus);

    const needsProviderSetup = useSettingsStore((state) => state.needsProviderSetup());

    const [errorNotification, setErrorNotification] = React.useState<{
        message: string;
        type: 'error' | 'warning' | 'info';
    } | null>(null);

    // Derive modelState from store for backward compatibility with child components
    const modelState = React.useMemo(() => ({
        mode,
        remoteModel,
        hasApiKey,
        conversationStartMode,
        isLoading: modelIsLoading,
    }), [mode, remoteModel, hasApiKey, conversationStartMode, modelIsLoading]);

    // Initialize model store on mount
    useEffect(() => {
        initializeModel();
    }, [initializeModel]);

    // Listen for API key changes in storage
    useEffect(() => {
        const handleStorageChange = async (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local') {
                if (changes.gemini_api_key || changes.ai_provider_config) {
                    refreshApiKeyStatus();
                }
            }
        };

        chrome.storage.onChanged.addListener(handleStorageChange);
        return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }, [refreshApiKeyStatus]);

    // Clear conversation mode on new thread
    const handleNewThread = (forceCreate?: boolean) => {
        clearConversationStartMode();
        clearAllDismissals();
        onNewThreadClick?.(forceCreate);
    };

    const handleModeChange = async (newMode: AIMode) => {
        setMode(newMode as StoreModelState['mode']);
    };

    const handleModelChange = async (newRemoteModel: RemoteModelType) => {
        setRemoteModel(newRemoteModel as StoreModelState['remoteModel']);
    };

    const handleError = (message: string, type: 'error' | 'warning' | 'info' = 'error') => {
        setErrorNotification({ message, type });
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            setErrorNotification(null);
        }, 5000);
    };

    const handleApiKeySaved = async () => {
        // Refresh API key state when dialog saves the key
        await refreshApiKeyStatus();
    };

    const handleOpenApiKeyDialog = () => {
        onProviderSetupClick?.();
    };

    return (
        <div className="flex flex-col h-screen w-full m-0 p-0 bg-[#0a0e1a] text-[#e4e6eb] fixed inset-0">
            {/* Model Download Progress Toasts */}
            <ModelDownloadToastContainer />

            {/* Error Notification */}
            {errorNotification && (
                <ErrorNotification
                    message={errorNotification.message}
                    type={errorNotification.type}
                    onDismiss={() => setErrorNotification(null)}
                />
            )}

            <ChatHeader
                onSettingsClick={onSettingsClick}
                onGeneralSettingsClick={onGeneralSettingsClick}
                onThreadsClick={onThreadsClick}
                onNewThreadClick={handleNewThread}
                onTroubleshootingClick={onTroubleshootingClick}
                onFeaturesClick={onFeaturesClick}
                onProviderSetupClick={onProviderSetupClick}
                onLoggerPanelClick={onLoggerPanelClick}
                isLoading={isLoading}
                needsProviderSetup={needsProviderSetup}
            />

            <ChatMessages
                messages={messages}
                isLoading={isLoading}
                messagesEndRef={messagesEndRef}
                pendingMessageId={pendingMessageId}
                isLocalMode={!ENV.HIDE_LOCAL_MODE && modelState.mode === 'local'}
                onConfigureApiKey={handleOpenApiKeyDialog}
                onContinue={onContinue}
                onRetry={onRetry}
                threadId={threadId}
                onQuoteText={(quotedText) => {
                    // Prepend quoted text to current input
                    const newValue = quotedText + input;
                    setInput(newValue);
                    // Focus the textarea and position cursor after the quoted text
                    setTimeout(() => {
                        const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
                        if (textarea) {
                            textarea.focus();
                            // Position cursor after the quoted text (at the end of the newlines)
                            const cursorPosition = quotedText.length;
                            textarea.setSelectionRange(cursorPosition, cursorPosition);
                        }
                    }, 0);
                }}
                addToolOutput={addToolOutput}
            />

            <ChatInput
                messages={messages}
                input={input}
                setInput={setInput}
                onSendMessage={onSendMessage}
                isLoading={isLoading}
                isRecording={isRecording}
                onRecordingChange={onRecordingChange}
                voiceInputRef={voiceInputRef}
                onStop={onStop}
                pendingMessageId={pendingMessageId}
                nextMessageId={nextMessageId}
                modelState={modelState}
                onModeChange={handleModeChange}
                onModelChange={handleModelChange}
                onApiKeySaved={handleApiKeySaved}
                onError={handleError}
                usage={usage}
                localPdfInfo={localPdfInfo}
            />
        </div>
    );
}
