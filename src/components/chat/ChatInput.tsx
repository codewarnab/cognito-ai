import React, { useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { UploadIcon } from '../UploadIcon';
import { VoiceInput } from '../../audio/VoiceInput';
import { ModeSelector } from './ModeSelector';
import { SendIcon } from './icons/SendIcon';
import { StopIcon } from './icons/StopIcon';
import { MentionInput } from '../MentionInput';
import type { ExecutionMode, Message } from './types';

interface ChatInputProps {
    messages: Message[];
    input: string;
    setInput: (value: string) => void;
    onSendMessage: (messageText?: string) => void;
    isLoading: boolean;
    isRecording?: boolean;
    onMicClick?: () => void;
    onStop?: () => void;
    pendingMessageId?: string | null;
    nextMessageId?: string;
    executionMode: ExecutionMode;
    onExecutionModeChange: (mode: ExecutionMode) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
    messages,
    input,
    setInput,
    onSendMessage,
    isLoading,
    isRecording,
    onMicClick,
    onStop,
    pendingMessageId,
    nextMessageId,
    executionMode,
    onExecutionModeChange,
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const uploadIconRef = useRef<any>(null);
    const [showModeDropdown, setShowModeDropdown] = React.useState(false);

    // Show suggestions when there are no messages
    const showSuggestedActions = messages.length === 0 && !input.trim() && !isLoading;

    const suggestedActions = [
        {
            title: 'How can I improve',
            label: 'my time management skills?',
            action: 'How can I improve my time management skills?',
        },
        {
            title: 'Suggest ideas for',
            label: 'a creative writing project',
            action: 'Suggest ideas for a creative writing project',
        },
        {
            title: 'What are some tips',
            label: 'for staying motivated?',
            action: 'What are some tips for staying motivated?',
        },
        {
            title: 'Help me brainstorm',
            label: 'ideas for a new hobby',
            action: 'Help me brainstorm ideas for a new hobby',
        },
    ];

    const handleSuggestionClick = (action: string) => {
        setInput(action);
        textareaRef.current?.focus();
    };

    return (
        <div className="copilot-input-container">
            {/* Suggested Actions */}
            <AnimatePresence>
                {showSuggestedActions && (
                    <motion.div
                        key="suggested-actions-container"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.2 }}
                        className="suggested-actions-container"
                    >
                        <div className="suggested-actions-grid">
                            {suggestedActions.map((suggestedAction, index) => (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 20 }}
                                    transition={{ delay: 0.05 * index }}
                                    key={`suggested-action-${index}`}
                                >
                                    <button
                                        onClick={() => handleSuggestionClick(suggestedAction.action)}
                                        className="suggested-action-button"
                                    >
                                        <span className="suggested-action-title">{suggestedAction.title}</span>
                                        <span className="suggested-action-label">
                                            {suggestedAction.label}
                                        </span>
                                    </button>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

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
                    onChange={() => { }}
                />

                <div className={`copilot-composer ${isRecording ? 'recording-blur' : ''}`}>
                    {/* Main input area - MentionInput with @ support */}
                    <div className="copilot-composer-primary">
                        <div style={{ position: 'relative', width: '100%' }}>
                            <MentionInput
                                value={input}
                                onChange={setInput}
                                onSend={() => {
                                    if (input.trim() && !isLoading) {
                                        onSendMessage();
                                    }
                                }}
                                disabled={isLoading}
                                placeholder="Ask me to do something (type @ to mention tabs)"
                                autoFocus={true}
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
                    </div>

                    {/* Bottom section with options (left) and buttons (right) */}
                    <div className="copilot-composer-bottom">
                        {/* Mode Selector - Bottom Left */}
                        <ModeSelector
                            executionMode={executionMode}
                            showModeDropdown={showModeDropdown}
                            onExecutionModeChange={onExecutionModeChange}
                            onToggleDropdown={setShowModeDropdown}
                        />

                        {/* Action Buttons - Bottom Right */}
                        <div className="copilot-composer-actions">
                            {/* Voice Input */}
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
                                    <SendIcon size={18} />
                                </button>
                            )}

                            {isLoading && onStop && (
                                <button
                                    type="button"
                                    onClick={onStop}
                                    className="copilot-stop-button-sm"
                                    title="Stop generation"
                                >
                                    <StopIcon size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
};
