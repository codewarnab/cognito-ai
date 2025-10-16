/**
 * Custom CopilotKit Chat Window Component
 * Adapted for Chrome Extension Side Panel
 * MERGED VERSION: Voice Input + Stop Button + Thread Management + Memory Panel
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { VoiceInput } from '../audio/VoiceInput';

interface Message {
    id?: string;
    role: 'user' | 'assistant';
    content: string;
    generativeUI?: () => React.ReactElement | null;
}

interface CopilotChatWindowProps {
    messages: Message[];
    input: string;
    setInput: (value: string) => void;
    onSendMessage: (messageText?: string) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onClearChat: () => void;
    isLoading: boolean;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    onSettingsClick?: () => void;
    onThreadsClick?: () => void;
    onNewThreadClick?: () => void;
    onMemoryClick?: () => void;
    onStop?: () => void;
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
    onStop,
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
                    <div className="copilot-header-actions">
                        {/* Thread History Button */}
                        {onThreadsClick && (
                            <button
                                className="threads-button"
                                onClick={onThreadsClick}
                                title="Chat History"
                                aria-label="View chat history"
                            >
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                            </button>
                        )}
                        {/* New Thread Button */}
                        {onNewThreadClick && (
                            <button
                                className="threads-button"
                                onClick={onNewThreadClick}
                                title="New Chat"
                                aria-label="Start new chat"
                            >
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path d="M12 5v14M5 12h14" />
                                </svg>
                            </button>
                        )}
                        {/* Memory Button */}
                        {onMemoryClick && (
                            <button
                                className="copilot-memory-button"
                                onClick={onMemoryClick}
                                title="Memory Management"
                                aria-label="Open memory panel"
                            >
                                💾
                            </button>
                        )}
                        {/* Settings Button */}
                        {onSettingsClick && (
                            <button
                                className="copilot-settings-button"
                                onClick={onSettingsClick}
                                title="MCP Server Settings"
                                aria-label="Open MCP settings"
                            >
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 20 20"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        d="M10 12.5C11.3807 12.5 12.5 11.3807 12.5 10C12.5 8.61929 11.3807 7.5 10 7.5C8.61929 7.5 7.5 8.61929 7.5 10C7.5 11.3807 8.61929 12.5 10 12.5Z"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                    <path
                                        d="M16.1667 12.5C16.0557 12.7513 16.0227 13.0301 16.0717 13.3006C16.1207 13.5711 16.2495 13.8203 16.4417 14.0167L16.4917 14.0667C16.6462 14.221 16.7687 14.4046 16.8522 14.6065C16.9356 14.8085 16.9784 15.0249 16.9784 15.2433C16.9784 15.4618 16.9356 15.6782 16.8522 15.8802C16.7687 16.0821 16.6462 16.2657 16.4917 16.42C16.3373 16.5745 16.1537 16.697 15.9518 16.7804C15.7498 16.8639 15.5334 16.9067 15.315 16.9067C15.0966 16.9067 14.8802 16.8639 14.6782 16.7804C14.4763 16.697 14.2927 16.5745 14.1383 16.42L14.0883 16.37C13.892 16.1778 13.6428 16.049 13.3723 16C13.1018 15.951 12.823 15.984 12.5717 16.095C12.3249 16.2011 12.1141 16.3773 11.9652 16.6029C11.8163 16.8286 11.7359 17.0942 11.7333 17.3667V17.5C11.7333 17.942 11.5577 18.366 11.2451 18.6785C10.9326 18.9911 10.5087 19.1667 10.0667 19.1667C9.62464 19.1667 9.20072 18.9911 8.88816 18.6785C8.57559 18.366 8.4 17.942 8.4 17.5V17.425C8.39198 17.1433 8.30209 16.8699 8.14134 16.6392C7.9806 16.4086 7.75604 16.2308 7.49667 16.1283C7.24537 16.0174 6.96654 15.9843 6.69605 16.0333C6.42556 16.0824 6.17634 16.2112 5.98 16.4033L5.93 16.4533C5.77562 16.6078 5.59206 16.7303 5.39011 16.8138C5.18816 16.8972 4.97176 16.94 4.75333 16.94C4.53491 16.94 4.31851 16.8972 4.11656 16.8138C3.91461 16.7303 3.73105 16.6078 3.57667 16.4533C3.42217 16.299 3.29964 16.1154 3.2162 15.9134C3.13275 15.7115 3.08997 15.4951 3.08997 15.2767C3.08997 15.0582 3.13275 14.8418 3.2162 14.6399C3.29964 14.438 3.42217 14.2544 3.57667 14.1L3.62667 14.05C3.81879 13.8537 3.9476 13.6044 3.99665 13.3339C4.04569 13.0634 4.01265 12.7846 3.90667 12.5333C3.80054 12.2866 3.62436 12.0758 3.39871 11.9269C3.17306 11.778 2.90744 11.6975 2.635 11.695H2.5C2.05797 11.695 1.63405 11.5194 1.32149 11.2069C1.00893 10.8943 0.833328 10.4704 0.833328 10.0283C0.833328 9.58631 1.00893 9.16239 1.32149 8.84982C1.63405 8.53726 2.05797 8.36166 2.5 8.36166H2.575C2.85675 8.35364 3.13009 8.26375 3.36076 8.103C3.59142 7.94226 3.76924 7.7177 3.87167 7.45833C3.98264 7.20703 4.01569 6.9282 3.96664 6.65771C3.9176 6.38722 3.78879 6.138 3.59667 5.94166L3.54667 5.89166C3.39217 5.73729 3.26964 5.55373 3.1862 5.35178C3.10275 5.14983 3.05997 4.93343 3.05997 4.715C3.05997 4.49657 3.10275 4.28017 3.1862 4.07822C3.26964 3.87627 3.39217 3.69271 3.54667 3.53833C3.70105 3.38383 3.88461 3.2613 4.08656 3.17786C4.28851 3.09441 4.50491 3.05163 4.72333 3.05163C4.94176 3.05163 5.15816 3.09441 5.36011 3.17786C5.56206 3.2613 5.74562 3.38383 5.9 3.53833L5.95 3.58833C6.14634 3.78045 6.39556 3.90926 6.66605 3.95831C6.93654 4.00736 7.21537 3.97431 7.46667 3.86833H7.56667C7.81337 3.7622 8.02416 3.58602 8.17308 3.36037C8.32199 3.13472 8.40244 2.8691 8.405 2.59666V2.5C8.405 2.05797 8.5806 1.63405 8.89316 1.32149C9.20573 1.00893 9.62964 0.833328 10.0717 0.833328C10.5137 0.833328 10.9376 1.00893 11.2502 1.32149C11.5627 1.63405 11.7383 2.05797 11.7383 2.5V2.575C11.7409 2.8474 11.8213 3.11302 11.9703 3.33867C12.1192 3.56432 12.33 3.7405 12.5767 3.84666C12.828 3.95765 13.1068 3.99069 13.3773 3.94164C13.6478 3.8926 13.897 3.76379 14.0933 3.57166L14.1433 3.52166C14.2977 3.36717 14.4813 3.24464 14.6832 3.16119C14.8852 3.07775 15.1016 3.03497 15.32 3.03497C15.5384 3.03497 15.7548 3.07775 15.9568 3.16119C16.1587 3.24464 16.3423 3.36717 16.4967 3.52166C16.6512 3.67604 16.7737 3.8596 16.8571 4.06155C16.9406 4.2635 16.9833 4.4799 16.9833 4.69833C16.9833 4.91676 16.9406 5.13316 16.8571 5.33511C16.7737 5.53706 16.6512 5.72062 16.4967 5.875L16.4467 5.925C16.2545 6.12134 16.1257 6.37056 16.0767 6.64105C16.0276 6.91154 16.0607 7.19037 16.1667 7.44166V7.54166C16.2728 7.78836 16.449 7.99915 16.6746 8.14807C16.9003 8.29698 17.1659 8.37743 17.4383 8.38V8.5C17.8804 8.5 18.3043 8.6756 18.6168 8.98816C18.9294 9.30072 19.105 9.72464 19.105 10.1667C19.105 10.6087 18.9294 11.0326 18.6168 11.3452C18.3043 11.6577 17.8804 11.8333 17.4383 11.8333H17.3633C17.0909 11.8359 16.8253 11.9163 16.5996 12.0653C16.374 12.2142 16.1978 12.425 16.0917 12.6717V12.5Z"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </button>
                        )}
                        {/* Clear Button */}
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
            </div>

            {/* Messages Area */}
            <div className="copilot-messages">
                {messages.length === 0 ? (
                    <div className="copilot-empty-state">
                        <div className="copilot-empty-icon">🤖</div>
                        <p>👋 Hi! I'm your autonomous AI assistant.</p>
                        <p className="copilot-empty-subtitle">
                            I can browse, click, fill forms, manage tabs, and execute tasks end-to-end. Just tell me what you need!
                        </p>
                    </div>
                ) : (
                    messages
                        .filter(message => {
                            const content = message.content;
                            return typeof content === 'string' && content.trim().length > 0;
                        })
                        .map((message, index) => (
                            <div
                                key={message.id || index}
                                className={`copilot-message copilot-message-${message.role}`}
                            >
                                {message.role === 'assistant' && (
                                    <div className="copilot-message-avatar">🤖</div>
                                )}

                                <div className={`copilot-message-bubble copilot-message-bubble-${message.role}`}>
                                    <div className="copilot-message-content">
                                        {message.role === 'assistant' ? (
                                            <div className="markdown-content">
                                                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                                    {message.content}
                                                </ReactMarkdown>
                                            </div>
                                        ) : (
                                            message.content
                                        )}
                                    </div>
                                    {/* Render generative UI from useFrontendAction/useFrontendTool render functions */}
                                    {message.role === 'assistant' && message.generativeUI && (
                                        <div className="copilot-generative-ui">
                                            {message.generativeUI()}
                                        </div>
                                    )}
                                </div>

                                {message.role === 'user' && (
                                    <div className="copilot-message-avatar">👤</div>
                                )}
                            </div>
                        ))
                )}

                {/* Loading Indicator */}
                {isLoading && (
                    <div
                        className="copilot-message copilot-message-assistant"
                        role="status"
                        aria-live="polite"
                        aria-label="Assistant is typing"
                    >
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
                        onKeyDown={onKeyDown}
                        placeholder="Ask me anything..."
                        className="copilot-input"
                        disabled={isLoading}
                    />
                    <div className="copilot-input-actions">
                        {/* Voice Input */}
                        <VoiceInput
                            onTranscript={(text) => setInput(text)}
                            onRecordingComplete={(finalText) => {
                                onSendMessage(finalText);
                                setInput('');
                            }}
                            className="copilot-voice-input"
                        />
                        {/* Conditional Stop/Send Button */}
                        {isLoading && onStop ? (
                            <button
                                onClick={onStop}
                                className="copilot-stop-button"
                                title="Stop generation"
                            >
                                ⏹️
                            </button>
                        ) : (
                            <button
                                onClick={() => onSendMessage()}
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
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}