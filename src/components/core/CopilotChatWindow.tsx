import React, { useState, useEffect } from 'react';
import { ChatHeader } from '../features/chat/components/ChatHeader';
import { ChatMessages } from '../features/chat/components/ChatMessages';
import { ChatInput } from '../features/chat/components/ChatInput';
import { ErrorNotification } from '../features/chat/components/ErrorNotification';
import { ProviderSetupDialog } from '../shared/dialogs';
import { ModelDownloadToastContainer } from '../shared/notifications';
import type { VoiceInputHandle } from '../../audio/VoiceInput';
import { getModelConfig, setModelConfig, clearConversationStartMode } from '../../utils/modelSettings';
import { hasGeminiApiKey } from '../../utils/geminiApiKey';
import type { Message, AIMode, RemoteModelType, ModelState } from '../features/chat/types';
import type { AppUsage } from '../../ai/types/usage';

interface CopilotChatWindowProps {
    messages: Message[];
    input: string;
    setInput: (value: string) => void;
    onSendMessage: (messageText?: string, attachments?: any[], workflowId?: string) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onClearChat: () => void;
    isLoading: boolean;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    onSettingsClick?: () => void;
    onThreadsClick?: () => void;
    onNewThreadClick?: () => void;
    onMemoryClick?: () => void;
    onRemindersClick?: () => void;
    onTroubleshootingClick?: () => void;
    onFeaturesClick?: () => void;
    onStop?: () => void;
    pendingMessageId?: string | null;
    nextMessageId?: string;
    isRecording?: boolean;
    onRecordingChange?: (isRecording: boolean) => void;
    voiceInputRef?: React.RefObject<VoiceInputHandle>;
    onContinue?: () => void; // Callback for continue button
    usage?: AppUsage | null; // Token usage tracking
}

export function CopilotChatWindow({
    messages,
    input,
    setInput,
    onSendMessage,
    isLoading,
    messagesEndRef,
    onSettingsClick,
    onThreadsClick,
    onNewThreadClick,
    onMemoryClick,
    onRemindersClick,
    onTroubleshootingClick,
    onFeaturesClick,
    onStop,
    pendingMessageId,
    nextMessageId,
    isRecording,
    onRecordingChange,
    voiceInputRef,
    onContinue,
    usage, // Token usage tracking
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
    const [showProviderDialog, setShowProviderDialog] = useState(false);

    // Load initial state with error handling
    useEffect(() => {
        async function loadModelState() {
            try {
                const config = await getModelConfig();
                const hasKey = await hasGeminiApiKey();

                setModelState({
                    mode: config.mode,
                    remoteModel: config.remoteModel,
                    hasApiKey: hasKey,
                    conversationStartMode: config.conversationStartMode,
                    isLoading: false,
                });
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
                    const hasKey = await hasGeminiApiKey();
                    setModelState(prev => ({
                        ...prev,
                        hasApiKey: hasKey,
                    }));
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
            const hasKey = await hasGeminiApiKey();
            setModelState(prev => ({
                ...prev,
                hasApiKey: hasKey,
            }));
        } catch (error) {
            console.error('Failed to check API key status:', error);
        }
    };

    const handleOpenApiKeyDialog = () => {
        setShowProviderDialog(true);
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
                onThreadsClick={onThreadsClick}
                onNewThreadClick={handleNewThread}
                onMemoryClick={onMemoryClick}
                onRemindersClick={onRemindersClick}
                onTroubleshootingClick={onTroubleshootingClick}
                onFeaturesClick={onFeaturesClick}
                onApiKeySaved={handleApiKeySaved}
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
            />

            {/* AI Provider Setup Dialog */}
            <ProviderSetupDialog
                isOpen={showProviderDialog}
                onClose={() => setShowProviderDialog(false)}
                onConfigSaved={handleApiKeySaved}
            />
        </div>
    );
}