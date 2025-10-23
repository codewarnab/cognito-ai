/**
 * Custom CopilotKit Chat Window Component
 * Adapted for Chrome Extension Side Panel
 * MERGED VERSION: Voice Input + Stop Button + Thread Management + Memory Panel
 */

import React, { useState, useEffect } from 'react';
import { ChatHeader } from './chat/ChatHeader';
import { ChatMessages } from './chat/ChatMessages';
import { ChatInput } from './chat/ChatInput';
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
    onMicClick?: () => void;
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
    onMicClick,
}: CopilotChatWindowProps) {
    const [modelState, setModelState] = useState<ModelState>({
        mode: 'local',
        remoteModel: 'gemini-2.5-flash',
        hasApiKey: false,
    });

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

    return (
        <div className="copilot-chat-window">
            <ChatHeader
                onSettingsClick={onSettingsClick}
                onThreadsClick={onThreadsClick}
                onNewThreadClick={handleNewThread}
                onMemoryClick={onMemoryClick}
                onRemindersClick={onRemindersClick}
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
                onMicClick={onMicClick}
                onStop={onStop}
                pendingMessageId={pendingMessageId}
                nextMessageId={nextMessageId}
                modelState={modelState}
                onModeChange={handleModeChange}
                onModelChange={handleModelChange}
                onSettingsClick={onSettingsClick}
            />
        </div>
    );
}