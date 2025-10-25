import React, { useState, useEffect } from 'react';
import { ChatHeader } from './chat/ChatHeader';
import { ChatMessages } from './chat/ChatMessages';
import { ChatInput } from './chat/ChatInput';
import { ErrorNotification } from './chat/ErrorNotification';
import type { VoiceInputHandle } from '../audio/VoiceInput';
import { getModelConfig, setModelConfig, setConversationStartMode, clearConversationStartMode } from '../utils/modelSettings';
import { hasGeminiApiKey } from '../utils/geminiApiKey';
import type { Message, AIMode, RemoteModelType, ModelState } from './chat/types';

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
    onStop?: () => void;
    pendingMessageId?: string | null;
    nextMessageId?: string;
    isRecording?: boolean;
    onRecordingChange?: (isRecording: boolean) => void;
    voiceInputRef?: React.RefObject<VoiceInputHandle>;
}

export function CopilotChatWindow({
    messages,
    input,
    setInput,
    onSendMessage,
    onKeyDown,
    onClearChat,
    isLoading,
    messagesEndRef,
    onSettingsClick,
    onThreadsClick,
    onNewThreadClick,
    onMemoryClick,
    onRemindersClick,
    onStop,
    pendingMessageId,
    nextMessageId,
    isRecording,
    onRecordingChange,
    voiceInputRef,
}: CopilotChatWindowProps) {
    const [modelState, setModelState] = useState<ModelState>({
        mode: 'local',
        remoteModel: 'gemini-2.5-flash',
        hasApiKey: false,
    });
    const [errorNotification, setErrorNotification] = useState<{
        message: string;
        type: 'error' | 'warning' | 'info';
    } | null>(null);

    // Load initial state
    useEffect(() => {
        async function loadModelState() {
            const config = await getModelConfig();
            const hasKey = await hasGeminiApiKey();

            setModelState({
                mode: config.mode,
                remoteModel: config.remoteModel,
                hasApiKey: hasKey,
                conversationStartMode: config.conversationStartMode,
            });
        }
        loadModelState();
    }, []);

    // Listen for API key changes in storage
    useEffect(() => {
        const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local' && changes.gemini_api_key) {
                // API key was added or removed
                const hasKey = !!changes.gemini_api_key.newValue;
                setModelState(prev => ({
                    ...prev,
                    hasApiKey: hasKey,
                }));
            }
        };

        chrome.storage.onChanged.addListener(handleStorageChange);
        return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }, []);

    // Track conversation start mode
    useEffect(() => {
        if (messages.length === 1 && !modelState.conversationStartMode) {
            // First message sent - lock the conversation mode
            setConversationStartMode(modelState.mode);
            setModelState(prev => ({
                ...prev,
                conversationStartMode: prev.mode,
            }));
        }
    }, [messages.length, modelState.mode, modelState.conversationStartMode]);

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
        const hasKey = await hasGeminiApiKey();
        setModelState(prev => ({
            ...prev,
            hasApiKey: hasKey,
        }));
    };

    return (
        <div className="copilot-chat-window">
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
                onApiKeySaved={handleApiKeySaved}
            />

            <ChatMessages
                messages={messages}
                isLoading={isLoading}
                messagesEndRef={messagesEndRef}
                pendingMessageId={pendingMessageId}
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
            />
        </div>
    );
}