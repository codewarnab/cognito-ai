import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { UploadIcon } from '../UploadIcon';
import { VoiceInput } from '../../audio/VoiceInput';
import { ModeSelector } from './ModeSelector';
import { SendIcon } from './icons/SendIcon';
import { StopIcon } from './icons/StopIcon';
import { PaperclipIcon } from './icons/PaperclipIcon';
import { MentionInput } from '../MentionInput';
import { FileAttachment, type FileAttachmentData } from './FileAttachment';
import { validateFile, createImagePreview, isImageFile } from '../../utils/fileProcessor';
import type { ExecutionMode } from './types';
import { createLogger } from '../../logger';

const log = createLogger('ChatInput');

interface ChatInputProps {
    input: string;
    setInput: (value: string) => void;
    onSendMessage: (messageText?: string, attachments?: FileAttachmentData[]) => void;
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
    const paperclipIconRef = useRef<any>(null);
    const [showModeDropdown, setShowModeDropdown] = useState(false);
    const [attachments, setAttachments] = useState<FileAttachmentData[]>([]);

    // Handle file selection
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        
        for (const file of files) {
            const validation = validateFile(file);
            
            if (!validation.valid) {
                log.error('File validation failed', { file: file.name, error: validation.error });
                alert(validation.error);
                continue;
            }

            const id = `${Date.now()}-${Math.random()}`;
            const type = isImageFile(file) ? 'image' : 'document';
            
            // Create preview for images
            let preview: string | undefined;
            if (type === 'image') {
                try {
                    preview = await createImagePreview(file);
                } catch (error) {
                    log.error('Failed to create image preview', error);
                }
            }

            setAttachments(prev => [
                ...prev,
                { id, file, preview, type }
            ]);
        }

        // Reset input
        e.target.value = '';
    };

    // Remove attachment
    const handleRemoveAttachment = (id: string) => {
        setAttachments(prev => prev.filter(att => att.id !== id));
    };

    // Handle send with attachments
    const handleSend = () => {
        if (!input.trim() && attachments.length === 0) return;
        
        onSendMessage(input, attachments);
        setAttachments([]);
    };

    return (
        <div className="copilot-input-container">
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                }}
                className="copilot-input-form"
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.txt,.md,.doc,.docx,.xls,.xlsx,.csv"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                />

                <div className={`copilot-composer ${isRecording ? 'recording-blur' : ''}`}>
                    {/* File Attachments Preview */}
                    {attachments.length > 0 && (
                        <div className="file-attachments-container">
                            {attachments.map(attachment => (
                                <FileAttachment
                                    key={attachment.id}
                                    attachment={attachment}
                                    onRemove={handleRemoveAttachment}
                                />
                            ))}
                        </div>
                    )}

                    {/* Main input area - MentionInput with @ support */}
                    <div className="copilot-composer-primary">
                        <div style={{ position: 'relative', width: '100%' }}>
                            <MentionInput
                                value={input}
                                onChange={setInput}
                                onSend={() => {
                                    if ((input.trim() || attachments.length > 0) && !isLoading) {
                                        handleSend();
                                    }
                                }}
                                disabled={isLoading}
                                placeholder={attachments.length > 0 
                                    ? "Add a message (optional)..." 
                                    : "Ask me to do something (type @ to mention tabs)"}
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
                                    onSendMessage(finalText, attachments);
                                    setInput('');
                                    setAttachments([]);
                                }}
                                className="copilot-voice-input"
                                externalRecordingState={isRecording}
                                onExternalRecordingToggle={onMicClick}
                            />

                            {/* Paperclip - File Upload */}
                            <button
                                type="button"
                                className="copilot-action-button"
                                title="Attach file (Images, PDFs, Documents)"
                                tabIndex={-1}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    fileInputRef.current?.click();
                                }}
                                onMouseEnter={() => paperclipIconRef.current?.startAnimation()}
                                onMouseLeave={() => paperclipIconRef.current?.stopAnimation()}
                            >
                                <PaperclipIcon ref={paperclipIconRef} size={16} />
                            </button>

                            {(input.trim() || attachments.length > 0) && !isLoading && (
                                <button
                                    type="submit"
                                    className="copilot-send-button-sm"
                                    title="Send message (Enter)"
                                    disabled={(!input.trim() && attachments.length === 0) || isLoading}
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
