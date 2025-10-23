/**
 * Custom CopilotKit Chat Window Component
 * Adapted for Chrome Extension Side Panel
 * MERGED VERSION: Voice Input + Stop Button + Thread Management + Memory Panel
 */

import React, { useState } from 'react';
import { ChatHeader } from './chat/ChatHeader';
import { ChatMessages } from './chat/ChatMessages';
import { ChatInput } from './chat/ChatInput';
import type { Message, ExecutionMode } from './chat/types';

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
    const [executionMode, setExecutionMode] = useState<ExecutionMode>('local');

    return (
        <div className="copilot-chat-window">
            <ChatHeader
                onSettingsClick={onSettingsClick}
                onThreadsClick={onThreadsClick}
                onNewThreadClick={onNewThreadClick}
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
                executionMode={executionMode}
                onExecutionModeChange={setExecutionMode}
            />
        </div>
    );
}