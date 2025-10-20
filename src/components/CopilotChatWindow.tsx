/**
 * Custom CopilotKit Chat Window Component
 * Adapted for Chrome Extension Side Panel
 * MERGED VERSION: Enhanced UI from chrome-ai + Functionalities from chrome-ai-1
 */

import React, { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { AnimatePresence, motion } from 'framer-motion';
import { PanelRightOpen, Plus, Wrench, MoreHorizontal } from 'lucide-react';
import { CloudCogIcon } from './CloudCogIcon';
import { UploadIcon } from './UploadIcon';
import { LaptopMinimalCheckIcon } from './LaptopMinimalCheckIcon';
import { AudioLinesIcon, AudioLinesIconHandle } from './AudioLinesIcon';
import { VoiceInput } from '../audio/VoiceInput';

interface Message {
    id?: string;
    role?: 'user' | 'assistant' | string;
    content?: string;
    text?: string;
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
    onStop,
    pendingMessageId,
    nextMessageId,
    isRecording,
    onMicClick,
}: CopilotChatWindowProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cloudCogRef = useRef<any>(null);
    const laptopIconRef = useRef<any>(null);
    
    
    const cloudCogDropdownActiveRef = useRef<any>(null);
    const cloudCogDropdownInactiveRef = useRef<any>(null);
    const laptopIconDropdownActiveRef = useRef<any>(null);
    const laptopIconDropdownInactiveRef = useRef<any>(null);
    const uploadIconRef = useRef<any>(null);
    const audioLinesIconRef = useRef<AudioLinesIconHandle>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [executionMode, setExecutionMode] = useState<'local' | 'cloud'>('local');
    const [showModeDropdown, setShowModeDropdown] = useState(false);
    const [showHeaderMenu, setShowHeaderMenu] = useState(false);

    React.useEffect(() => {
        const handleClickOutside = () => setShowHeaderMenu(false);
        if (showHeaderMenu) {
            window.addEventListener('click', handleClickOutside, { once: true });
        }
        return () => window.removeEventListener('click', handleClickOutside);
    }, [showHeaderMenu]);

    return (
        <div className="copilot-chat-window">
            {/* Header */}
            <div className="copilot-header">
                <div className="copilot-header-content">
                    {/* Sidebar toggle (opens Chat History side panel) */}
                    <div className="copilot-header-left">
                        {onThreadsClick && (
                            <button
                                className="copilot-header-button"
                                onClick={onThreadsClick}
                                title="Open chat history"
                                aria-label="Open chat history"
                            >
                                <PanelRightOpen size={18} />
                            </button>
                        )}
                    </div>

                    {/* Action Buttons: Plus, Tools, Kebab (right-aligned) */}
                    <div className="copilot-header-actions">
                        {/* New Thread (Plus) */}
                        {onNewThreadClick && (
                            <button
                                className="copilot-header-button"
                                onClick={onNewThreadClick}
                                title="New Chat"
                                aria-label="Start new chat"
                            >
                                <Plus size={16} />
                            </button>
                        )}

                        {/* Tools / Settings (Wrench) */}
                        {onSettingsClick && (
                            <button
                                className="copilot-header-button"
                                onClick={onSettingsClick}
                                title="MCP Server Settings"
                                aria-label="Open MCP settings"
                            >
                                <Wrench size={16} />
                            </button>
                        )}

                        {/* Kebab Menu (Three dots) */}
                        <div className="copilot-header-menu-wrapper">
                            <button
                                className="copilot-header-button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowHeaderMenu((v) => !v);
                                }}
                                title="More options"
                                aria-label="More options"
                            >
                                <MoreHorizontal size={18} />
                            </button>

                            {showHeaderMenu && (
                                <div className="copilot-header-menu" onClick={(e) => e.stopPropagation()}>
                                    <button className="copilot-header-menu-item" onClick={() => { setShowHeaderMenu(false); onMemoryClick?.(); }}>
                                        Memory Management
                                    </button>
                                    <button className="copilot-header-menu-item" onClick={() => { setShowHeaderMenu(false); alert('Reminders section coming soon'); }}>
                                        Reminders
                                    </button>
                                    <button className="copilot-header-menu-item" onClick={() => { setShowHeaderMenu(false); alert('Gemini API key setup coming soon'); }}>
                                        Gemini API Key Setup
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="copilot-messages">
                {messages.length === 0 ? (
                    <div className="copilot-empty-state">
                        <div className="copilot-empty-icon">
                            <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <defs>
                                    <filter id="glow-empty" x="-50%" y="-50%" width="200%" height="200%">
                                        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                                        <feMerge>
                                            <feMergeNode in="coloredBlur"/>
                                            <feMergeNode in="SourceGraphic"/>
                                        </feMerge>
                                    </filter>
                                </defs>
                                {/* Head */}
                                <rect x="28" y="20" width="44" height="38" rx="8" fill="none" stroke="#7dd3fc" strokeWidth="2" filter="url(#glow-empty)" opacity="0.8"/>
                                {/* Antenna */}
                                <line x1="50" y1="20" x2="50" y2="5" stroke="#7dd3fc" strokeWidth="2" filter="url(#glow-empty)" opacity="0.8"/>
                                <circle cx="50" cy="3" r="3" fill="#7dd3fc" filter="url(#glow-empty)"/>
                                {/* Left Eye */}
                                <circle cx="38" cy="32" r="5" fill="#e0f2fe" filter="url(#glow-empty)"/>
                                <circle cx="38" cy="32" r="3" fill="#0284c7"/>
                                {/* Right Eye */}
                                <circle cx="62" cy="32" r="5" fill="#e0f2fe" filter="url(#glow-empty)"/>
                                <circle cx="62" cy="32" r="3" fill="#0284c7"/>
                                {/* Left Ear */}
                                <circle cx="20" cy="38" r="6" fill="none" stroke="#7dd3fc" strokeWidth="2" filter="url(#glow-empty)" opacity="0.8"/>
                                {/* Right Ear */}
                                <circle cx="80" cy="38" r="6" fill="none" stroke="#7dd3fc" strokeWidth="2" filter="url(#glow-empty)" opacity="0.8"/>
                                {/* Body */}
                                <rect x="25" y="65" width="50" height="28" rx="6" fill="none" stroke="#7dd3fc" strokeWidth="2" filter="url(#glow-empty)" opacity="0.8"/>
                                {/* Mouth/Display Lines */}
                                <line x1="35" y1="78" x2="65" y2="78" stroke="#7dd3fc" strokeWidth="1.5" filter="url(#glow-empty)" opacity="0.8"/>
                                <line x1="35" y1="84" x2="65" y2="84" stroke="#7dd3fc" strokeWidth="1.5" filter="url(#glow-empty)" opacity="0.8"/>
                            </svg>
                        </div>
                        <p>👋 Hi! I'm your autonomous AI assistant.</p>
                        <p className="copilot-empty-subtitle">
                            I can browse, click, fill forms, manage tabs, and execute tasks end-to-end. Just tell me what you need!
                        </p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {messages
                        .filter(message => {
                                const content = message.content || message.text || '';
                                return content && typeof content === 'string' && content.trim().length > 0;
                            })
                            .map((message, index, filteredMessages) => {
                                // Check if this is the pending message (currently animating)
                                const isPendingMessage = message.role === 'user' && message.id === pendingMessageId;
                                
                                return (
                                    <motion.div
                                key={message.id || index}
                                        layout="position"
                                        layoutId={isPendingMessage ? `message-${pendingMessageId}` : undefined}
                                        transition={{ type: 'easeOut', duration: 0.2 }}
                                        initial={isPendingMessage ? { opacity: 0 } : undefined}
                                        animate={isPendingMessage ? { opacity: 1 } : undefined}
                                        className={`copilot-message copilot-message-${message.role || 'assistant'}`}
                            >

                                    <div className={`copilot-message-bubble copilot-message-bubble-${message.role || 'assistant'}`}>
                                    <div className="copilot-message-content">
                                        {message.role === 'assistant' ? (
                                            <div className="markdown-content">
                                                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                                        {message.content || message.text || ''}
                                                </ReactMarkdown>
                                            </div>
                                        ) : (
                                                message.content || message.text || ''
                                        )}
                                    </div>
                                    {/* Render generative UI from useFrontendAction/useFrontendTool render functions */}
                                    {message.role === 'assistant' && message.generativeUI && (
                                        <div className="copilot-generative-ui">
                                            {message.generativeUI()}
                                        </div>
                                    )}
                                </div>

                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                )}

                {/* Loading Indicator */}
                {isLoading && (
                    <motion.div
                        layout="position"
                        layoutId="loading-message"
                        transition={{ type: 'easeOut', duration: 0.2 }}
                        className="copilot-message copilot-message-assistant"
                    >
                        <div className="copilot-message-bubble copilot-message-bubble-assistant">
                            <div className="copilot-loading">
                                <div className="copilot-loading-dot" style={{ animationDelay: '0ms' }}></div>
                                <div className="copilot-loading-dot" style={{ animationDelay: '150ms' }}></div>
                                <div className="copilot-loading-dot" style={{ animationDelay: '300ms' }}></div>
                            </div>
                        </div>
                    </motion.div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="copilot-input-container">
                <form 
                    onSubmit={(e) => { 
                        e.preventDefault(); 
                        onSendMessage(); 
                    }} 
                    className="copilot-input-form"
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        style={{ display: 'none' }}
                        onChange={() => {}}
                    />

                    <div className={`copilot-composer ${isRecording ? 'recording-blur' : ''}`}>
                        {/* Main input area - Textarea */}
                        <div className="copilot-composer-primary">
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={(e) => {
                                    setInput(e.target.value);
                                    if (textareaRef.current) {
                                        textareaRef.current.style.height = 'auto';
                                        const newHeight = Math.min(textareaRef.current.scrollHeight, 32);
                                        textareaRef.current.style.height = `${newHeight}px`;
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        if (input.trim() && !isLoading) {
                                            onSendMessage();
                                            if (textareaRef.current) {
                                                textareaRef.current.style.height = 'auto';
                                            }
                                        }
                                    }
                                }}
                                placeholder="Ask me to do something"
                                className={`copilot-textarea ${isRecording ? 'recording-blur' : ''}`}
                                rows={1}
                                disabled={isLoading}
                                spellCheck="false"
                            />
                            
                            {/* Animated Preview Overlay - iMessage style */}
                            <AnimatePresence>
                                {input.trim() && !pendingMessageId && nextMessageId && (
                                    <motion.div
                                        key="input-preview"
                                        layout="position"
                                        className="copilot-textarea-preview-wrapper"
                                        layoutId={`message-${nextMessageId}`}
                                        transition={{ type: 'easeOut', duration: 0.2 }}
                                        initial={{ opacity: 0.6, zIndex: -1 }}
                                        animate={{ opacity: 0.6, zIndex: -1 }}
                                        exit={{ opacity: 1, zIndex: 1 }}
                                    >
                                        <div className="copilot-textarea-preview-content">
                                            {input}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Bottom section with options (left) and buttons (right) */}
                        <div className="copilot-composer-bottom">
                            {/* Mode Selector - Bottom Left */}
                            <div className="copilot-composer-options">
                                {!showModeDropdown ? (
                                    <button
                                        type="button"
                                        className="copilot-mode-inline-button"
                                        onClick={() => setShowModeDropdown(true)}
                                        title="Execution mode"
                                        onMouseEnter={() => {
                                            if (executionMode === 'cloud') {
                                                cloudCogRef.current?.startAnimation();
                                            } else {
                                                laptopIconRef.current?.startAnimation();
                                            }
                                        }}
                                        onMouseLeave={() => {
                                            if (executionMode === 'cloud') {
                                                cloudCogRef.current?.stopAnimation();
                                            } else {
                                                laptopIconRef.current?.stopAnimation();
                                            }
                                        }}
                                    >
                                        {executionMode === 'local' ? (
                                            <LaptopMinimalCheckIcon ref={laptopIconRef} size={14} />
                                        ) : (
                                            <CloudCogIcon ref={cloudCogRef} size={14} />
                                        )}
                                        <span>{executionMode === 'local' ? 'Local' : 'Cloud'}</span>
                                    </button>
                                ) : (
                                    <div className="copilot-mode-expanded">
                                        {executionMode === 'local' ? (
                                            <>
                                                <button
                                                    type="button"
                                                    className="copilot-mode-expanded-option active"
                                                    onClick={() => setShowModeDropdown(false)}
                                                    onMouseEnter={() => laptopIconDropdownActiveRef.current?.startAnimation()}
                                                    onMouseLeave={() => laptopIconDropdownActiveRef.current?.stopAnimation()}
                                                >
                                                    <LaptopMinimalCheckIcon ref={laptopIconDropdownActiveRef} size={14} />
                                                    Local
                                                </button>
                                                <button
                                                    type="button"
                                                    className="copilot-mode-expanded-option"
                                                    onClick={() => {
                                                        setExecutionMode('cloud');
                                                        setShowModeDropdown(false);
                                                    }}
                                                    onMouseEnter={() => cloudCogDropdownInactiveRef.current?.startAnimation()}
                                                    onMouseLeave={() => cloudCogDropdownInactiveRef.current?.stopAnimation()}
                                                >
                                                    <CloudCogIcon ref={cloudCogDropdownInactiveRef} size={14} />
                                                    Cloud
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    className="copilot-mode-expanded-option active"
                                                    onClick={() => setShowModeDropdown(false)}
                                                    onMouseEnter={() => cloudCogDropdownActiveRef.current?.startAnimation()}
                                                    onMouseLeave={() => cloudCogDropdownActiveRef.current?.stopAnimation()}
                                                >
                                                    <CloudCogIcon ref={cloudCogDropdownActiveRef} size={14} />
                                                    Cloud
                                                </button>
                                                <button
                                                    type="button"
                                                    className="copilot-mode-expanded-option"
                                                    onClick={() => {
                                                        setExecutionMode('local');
                                                        setShowModeDropdown(false);
                                                    }}
                                                    onMouseEnter={() => laptopIconDropdownInactiveRef.current?.startAnimation()}
                                                    onMouseLeave={() => laptopIconDropdownInactiveRef.current?.stopAnimation()}
                                                >
                                                    <LaptopMinimalCheckIcon ref={laptopIconDropdownInactiveRef} size={14} />
                                                    Local
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons - Bottom Right */}
                            <div className="copilot-composer-actions">
                                {/* Voice Input - Enhanced from chrome-ai-1 */}
                        <VoiceInput
                            onTranscript={(text) => setInput(text)}
                            onRecordingChange={(recording) => {
                                // External recording state is managed by parent component
                                // The pill animation will show based on external state
                            }}
                            onRecordingComplete={(finalText) => {
                                onSendMessage(finalText);
                                setInput('');
                            }}
                            className="copilot-voice-input"
                            externalRecordingState={isRecording}
                            onExternalRecordingToggle={onMicClick}
                        />

                            <button
                                    type="button"
                                    className="copilot-action-button"
                                    title="Upload file"
                                    tabIndex={-1}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        fileInputRef.current?.click();
                                    }}
                                    onMouseEnter={() => uploadIconRef.current?.startAnimation()}
                                    onMouseLeave={() => uploadIconRef.current?.stopAnimation()}
                                >
                                    <UploadIcon ref={uploadIconRef} size={16} />
                            </button>

                                {input.trim() && !isLoading && (
                            <button
                                        type="submit"
                                        className="copilot-send-button-sm"
                                        title="Send message (Enter)"
                                disabled={!input.trim() || isLoading}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.8429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 L4.13399899,1.16770919 C3.34915502,0.9106 2.40734225,1.0218622 1.77946707,1.4931544 C0.994623095,2.1274181 0.837654308,3.21681268 1.15159189,3.99914249 L3.03521743,10.4401365 C3.03521743,10.5972338 3.19218622,10.7543312 3.50612381,10.7543312 L16.6915026,11.5398181 C16.6915026,11.5398181 17.1624089,11.5398181 17.1624089,12.0111102 C17.1624089,12.4744748 16.6915026,12.4744748 16.6915026,12.4744748 Z"/>
                                        </svg>
                                    </button>
                                )}

                                {isLoading && onStop && (
                                    <button
                                        type="button"
                                        onClick={onStop}
                                        className="copilot-stop-button-sm"
                                        title="Stop generation"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                            <rect x="5" y="5" width="14" height="14" rx="2"></rect>
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
                    </div>
                </form>
                {/* Floating Recording Pill scoped to input container for perfect centering */}
                <AnimatePresence mode="wait">
                    {isRecording && (
                        <motion.div
                            className="voice-recording-pill"
                            style={{
                                position: 'absolute',
                                top: '-50px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                margin: '0',
                                right: 'auto'
                            }}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                            onAnimationStart={() => {
                                if (isRecording) {
                                    audioLinesIconRef.current?.startAnimation();
                                }
                            }}
                            onAnimationComplete={() => {
                                if (!isRecording) {
                                    audioLinesIconRef.current?.stopAnimation();
                                }
                            }}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onMicClick?.();
                            }}
                        >
                            <AudioLinesIcon 
                                ref={audioLinesIconRef} 
                                size={16} 
                                style={{ color: 'white' }} 
                            />
                            <span className="recording-text">Click to finish recording</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}