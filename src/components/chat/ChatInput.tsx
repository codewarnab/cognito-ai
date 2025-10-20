import React, { useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { UploadIcon } from '../UploadIcon';
import { VoiceInput } from '../../audio/VoiceInput';
import { ModeSelector } from './ModeSelector';
import { SendIcon } from './icons/SendIcon';
import { StopIcon } from './icons/StopIcon';
import { MentionInput } from '../MentionInput';
import type { ExecutionMode } from './types';

interface ChatInputProps {
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

    return (
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
