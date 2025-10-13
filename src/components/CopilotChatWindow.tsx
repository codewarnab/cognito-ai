/**
 * Custom CopilotKit Chat Window Component
 * Adapted for Chrome Extension Side Panel
 */

import React from 'react';

interface Message {
    id?: string;
    role?: 'user' | 'assistant' | string;
    content?: string;
    text?: string;
}

interface CopilotChatWindowProps {
    messages: Message[];
    input: string;
    setInput: (value: string) => void;
    onSendMessage: () => void;
    onKeyPress: (e: React.KeyboardEvent) => void;
    onClearChat: () => void;
    isLoading: boolean;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export function CopilotChatWindow({
    messages,
    input,
    setInput,
    onSendMessage,
    onKeyPress,
    onClearChat,
    isLoading,
    messagesEndRef,
}: CopilotChatWindowProps) {
    return (
        <div className="copilot-chat-window">
            {/* Header */}
            <div className="copilot-header">
                <div className="copilot-header-content">
                    <div className="copilot-avatar">🤖</div>
                    <div className="copilot-title">
                        <h3>AI Assistant</h3>
                        <p>Powered by CopilotKit</p>
                    </div>
                    <button
                        className="copilot-clear-button"
                        onClick={onClearChat}
                        title="Clear chat history"
                        disabled={messages.length === 0}
                    >
                        🗑️ Clear
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div className="copilot-messages">
                {messages.length === 0 ? (
                    <div className="copilot-empty-state">
                        <div className="copilot-empty-icon">🤖</div>
                        <p>👋 Hi! I'm your AI assistant.</p>
                        <p className="copilot-empty-subtitle">
                            I can help you with browsing, tab management, and more.
                        </p>
                    </div>
                ) : (
                    messages
                        .filter(message => {
                            const content = message.content || message.text || '';
                            return content && typeof content === 'string' && content.trim().length > 0;
                        })
                        .map((message, index) => (
                            <div
                                key={message.id || index}
                                className={`copilot-message copilot-message-${message.role || 'assistant'}`}
                            >
                                {message.role === 'assistant' && (
                                    <div className="copilot-message-avatar">🤖</div>
                                )}

                                <div className={`copilot-message-bubble copilot-message-bubble-${message.role || 'assistant'}`}>
                                    <div className="copilot-message-content">
                                        {message.content || message.text || ''}
                                    </div>
                                </div>

                                {message.role === 'user' && (
                                    <div className="copilot-message-avatar">👤</div>
                                )}
                            </div>
                        ))
                )}

                {/* Loading Indicator */}
                {isLoading && (
                    <div className="copilot-message copilot-message-assistant">
                        <div className="copilot-message-avatar">🤖</div>
                        <div className="copilot-message-bubble copilot-message-bubble-assistant">
                            <div className="copilot-loading">
                                <div className="copilot-loading-dot" style={{ animationDelay: '0ms' }}></div>
                                <div className="copilot-loading-dot" style={{ animationDelay: '150ms' }}></div>
                                <div className="copilot-loading-dot" style={{ animationDelay: '300ms' }}></div>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="copilot-input-container">
                <div className="copilot-input-wrapper">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={onKeyPress}
                        placeholder="Ask me anything..."
                        className="copilot-input"
                        disabled={isLoading}
                    />
                    <button
                        onClick={onSendMessage}
                        disabled={!input.trim() || isLoading}
                        className="copilot-send-button"
                        title="Send message"
                    >
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <path d="M22 2L11 13" />
                            <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
