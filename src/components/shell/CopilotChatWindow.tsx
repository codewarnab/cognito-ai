import React, { useState, useEffect } from 'react';
import { ChatHeader } from '@/components/features/chat/components/display';
import { ChatMessages } from '@/components/features/chat/components/display';
import { ChatInput } from '@/components/features/chat/components/composer';
import { ErrorNotification } from '@/components/features/chat/components/feedback';
import { ModelDownloadToastContainer } from '@/components/shared/notifications';
import type { VoiceInputHandle } from '@/audio/VoiceInput';
import { getModelConfig, setModelConfig, clearConversationStartMode } from '@/utils/modelSettings';
import { hasGoogleApiKey, hasAnyProviderConfigured } from '@/utils/providerCredentials';
import type { Message, AIMode, RemoteModelType, ModelState } from '@/components/features/chat/types';
import type { AppUsage } from '@/ai/types/usage';
import type { LocalPdfInfo } from '@/hooks/useActiveTabDetection';
import { clearAllDismissals } from '@/utils/localPdfDismissals';

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
    onNewThreadClick?: () => void;
    onMemoryClick?: () => void;
    onRemindersClick?: () => void;
    onTroubleshootingClick?: () => void;
    onFeaturesClick?: () => void;
    onProviderSetupClick?: () => void;
    onStop?: () => void;
    pendingMessageId?: string | null;
    nextMessageId?: string;
    isRecording?: boolean;
    onRecordingChange?: (isRecording: boolean) => void;
    voiceInputRef?: React.RefObject<VoiceInputHandle>;
    onContinue?: () => void; // Callback for continue button
    usage?: AppUsage | null; // Token usage tracking
    localPdfInfo?: LocalPdfInfo | null; // Local PDF detection info
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
    onMemoryClick,
    onRemindersClick,
    onTroubleshootingClick,
    onFeaturesClick,
    onProviderSetupClick,
    onStop,
    pendingMessageId,
    nextMessageId,
    isRecording,
    onRecordingChange,
    voiceInputRef,
    onContinue,
    usage, // Token usage tracking
    localPdfInfo, // Local PDF detection info
}: CopilotChatWindowProps) {
    // Lazy initialization: compute initial state synchronously
    const [modelState, setModelState] = useState<ModelState>(() => {
        // Return a default state; will be hydrated in useEffect
        return {
            mode: 'local',
            remoteModel: 'gemini-2.5-flash',
            hasApiKey: false,
            isLoading: true, // Track loading state
        };
    });
    const [errorNotification, setErrorNotification] = useState<{
        message: string;
        type: 'error' | 'warning' | 'info';
    } | null>(null);
    const [needsProviderSetup, setNeedsProviderSetup] = useState(false);

    // Load initial state with error handling
    useEffect(() => {
        async function loadModelState() {
            try {
                const config = await getModelConfig();
                const hasKey = await hasGoogleApiKey();
                const hasProvider = await hasAnyProviderConfigured();

                setModelState({
                    mode: config.mode,
                    remoteModel: config.remoteModel,
                    hasApiKey: hasKey,
                    conversationStartMode: config.conversationStartMode,
                    isLoading: false,
                });
                setNeedsProviderSetup(!hasProvider);
            } catch (error) {
                console.error('Failed to load model state:', error);
                // Set error state but keep defaults
                setModelState(prev => ({
                    ...prev,
                    isLoading: false,
                }));
            }
        }
        loadModelState();
    }, []);

    // Listen for API key changes in storage (both old and new storage systems)
    useEffect(() => {
        const handleStorageChange = async (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local') {
                // Check old storage key (legacy)
                if (changes.gemini_api_key) {
                    const hasKey = !!changes.gemini_api_key.newValue;
                    setModelState(prev => ({
                        ...prev,
                        hasApiKey: hasKey,
                    }));
                }

                // Check new provider config storage
                if (changes.ai_provider_config) {
                    const hasKey = await hasGoogleApiKey();
                    const hasProvider = await hasAnyProviderConfigured();
                    setModelState(prev => ({
                        ...prev,
                        hasApiKey: hasKey,
                    }));
                    setNeedsProviderSetup(!hasProvider);
                }
            }
        };

        chrome.storage.onChanged.addListener(handleStorageChange);
        return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }, []);

    // Clear conversation mode on new thread
    const handleNewThread = () => {
        clearConversationStartMode();
        setModelState(prev => ({
            ...prev,
            conversationStartMode: undefined,
        }));

        // Always clear PDF dismissals when user clicks new thread
        // This ensures fresh suggestions even if already on a new/empty thread
        clearAllDismissals();

        if (onNewThreadClick) {
            onNewThreadClick();
        }
    };

    const handleModeChange = async (mode: AIMode) => {
        await setModelConfig({ mode });
        setModelState(prev => ({ ...prev, mode }));
    };

    const handleModelChange = async (remoteModel: RemoteModelType) => {
        await setModelConfig({ remoteModel });
        setModelState(prev => ({ ...prev, remoteModel }));
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
        try {
            const hasKey = await hasGoogleApiKey();
            setModelState(prev => ({
                ...prev,
                hasApiKey: hasKey,
            }));
        } catch (error) {
            console.error('Failed to check API key status:', error);
        }
    };

    const handleOpenApiKeyDialog = () => {
        onProviderSetupClick?.();
    };

    return (
        <div className="copilot-chat-window">
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
                onMemoryClick={onMemoryClick}
                onRemindersClick={onRemindersClick}
                onTroubleshootingClick={onTroubleshootingClick}
                onFeaturesClick={onFeaturesClick}
                onProviderSetupClick={onProviderSetupClick}
                isLoading={isLoading}
                needsProviderSetup={needsProviderSetup}
            />

            <ChatMessages
                messages={messages}
                isLoading={isLoading}
                messagesEndRef={messagesEndRef}
                pendingMessageId={pendingMessageId}
                isLocalMode={modelState.mode === 'local'}
                onConfigureApiKey={handleOpenApiKeyDialog}
                onContinue={onContinue}
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
