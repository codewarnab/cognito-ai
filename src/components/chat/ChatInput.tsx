import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { UploadIcon } from '../UploadIcon';
import { VoiceInput, type VoiceInputHandle } from '../../audio/VoiceInput';
import { ModeSelector } from './ModeSelector';
import { LocalBanner } from './LocalBanner';
import { SendIcon } from './icons/SendIcon';
import { StopIcon } from './icons/StopIcon';
import { PaperclipIcon } from './icons/PaperclipIcon';
import { MentionInput } from '../MentionInput';
import { FileAttachment, type FileAttachmentData } from './FileAttachment';
import { validateFile, createImagePreview, isImageFile } from '../../utils/fileProcessor';
import type { AIMode, RemoteModelType, ModelState, Message } from './types';
import { SlashCommandDropdown } from './SlashCommandDropdown';
import { WorkflowBadge } from './WorkflowBadge';
import type { WorkflowDefinition } from '../../workflows/types';
import { replaceSlashCommand } from '../../utils/slashCommandUtils';

interface ChatInputProps {
    messages: Message[];
    input: string;
    setInput: (value: string) => void;
    onSendMessage: (messageText?: string, attachments?: FileAttachmentData[], workflowId?: string) => void;
    isLoading: boolean;
    isRecording?: boolean;
    onRecordingChange?: (isRecording: boolean) => void;
    voiceInputRef?: React.RefObject<VoiceInputHandle>;
    onStop?: () => void;
    pendingMessageId?: string | null;
    nextMessageId?: string;
    modelState: ModelState;
    onModeChange: (mode: AIMode) => void;
    onModelChange: (model: RemoteModelType) => void;
    onApiKeySaved?: () => void;
    onError?: (message: string, type?: 'error' | 'warning' | 'info') => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
    messages,
    input,
    setInput,
    onSendMessage,
    isLoading,
    isRecording,
    onRecordingChange,
    voiceInputRef: externalVoiceInputRef,
    onStop,
    pendingMessageId,
    nextMessageId,
    modelState,
    onModeChange,
    onModelChange,
    onApiKeySaved,
    onError,
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const paperclipIconRef = useRef<any>(null);
    const composerRef = useRef<HTMLDivElement>(null);
    const internalVoiceInputRef = useRef<VoiceInputHandle>(null);
    const [showModeDropdown, setShowModeDropdown] = useState(false);
    const [attachments, setAttachments] = useState<FileAttachmentData[]>([]);

    // Workflow state
    const [activeWorkflow, setActiveWorkflow] = useState<WorkflowDefinition | null>(null);
    const [showSlashDropdown, setShowSlashDropdown] = useState(false);
    const [slashSearchQuery, setSlashSearchQuery] = useState('');

    // Use external ref if provided, otherwise use local ref
    const voiceInputRef = externalVoiceInputRef || internalVoiceInputRef;

    // Handle file selection
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        await processFiles(files);
        // Reset input
        e.target.value = '';
    };

    // Process files (shared between file input and paste)
    const processFiles = async (files: File[]) => {
        for (const file of files) {
            const validation = validateFile(file);

            if (!validation.valid) {
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
                    console.error('Failed to create image preview', error);
                }
            }

            setAttachments(prev => [
                ...prev,
                { id, file, preview, type }
            ]);
        }
    };

    // Handle paste event for file pasting
    const handlePaste = async (e: ClipboardEvent) => {
        // Check if there are files in the clipboard
        if (!e.clipboardData?.files.length) {
            return;
        }

        // Prevent default paste behavior when pasting files
        e.preventDefault();

        const files = Array.from(e.clipboardData.files);
        await processFiles(files);
    };

    // Remove attachment
    const handleRemoveAttachment = (id: string) => {
        setAttachments(prev => prev.filter(att => att.id !== id));
    };

    // Handle send with attachments
    const handleSend = () => {
        if (!input.trim() && attachments.length === 0) return;

        // If workflow is active, add workflow metadata to message
        if (activeWorkflow) {
            onSendMessage(input, attachments, activeWorkflow.id);
            // Clear workflow mode after sending
            setActiveWorkflow(null);
        } else {
            onSendMessage(input, attachments);
        }

        setInput('');
        setAttachments([]);
    };

    // Handle workflow selection from slash command dropdown
    const handleSelectWorkflow = (workflow: WorkflowDefinition) => {
        setActiveWorkflow(workflow);
        setShowSlashDropdown(false);

        // Clear the slash command from input
        const cursorPos = input.length;
        const result = replaceSlashCommand(input, cursorPos, workflow.id);
        setInput(result.newText);
    };

    // Handle clearing workflow mode
    const handleClearWorkflow = () => {
        setActiveWorkflow(null);
    };

    // Handle slash command detection from MentionInput
    const handleSlashCommandDetection = (isSlash: boolean, searchQuery: string) => {
        if (isSlash) {
            setSlashSearchQuery(searchQuery);
            setShowSlashDropdown(true);
        } else {
            setShowSlashDropdown(false);
        }
    };

    // Add paste event listener for file pasting
    React.useEffect(() => {
        const composerElement = composerRef.current;
        if (!composerElement) return;

        composerElement.addEventListener('paste', handlePaste as any);

        return () => {
            composerElement.removeEventListener('paste', handlePaste as any);
        };
    }, []);

    // Show suggestions when there are no messages and no active workflow
    const showSuggestedActions = messages.length === 0 && !input.trim() && !isLoading && !activeWorkflow;

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
            {/* Show banner when in local mode */}
            {modelState.mode === 'local' && (
                <LocalBanner onApiKeySaved={onApiKeySaved} />
            )}

            {/* Suggested Actions */}
            <AnimatePresence>
                {showSuggestedActions && !isRecording && (
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

                <div ref={composerRef} className={`copilot-composer ${isRecording ? 'recording-blur' : ''}`}>
                    {/* Workflow Badge - shows when workflow is active */}
                    {activeWorkflow && (
                        <WorkflowBadge
                            workflow={activeWorkflow}
                            onClose={handleClearWorkflow}
                        />
                    )}

                    {/* Slash Command Dropdown */}
                    {showSlashDropdown && !activeWorkflow && (
                        <SlashCommandDropdown
                            searchQuery={slashSearchQuery}
                            onSelectWorkflow={handleSelectWorkflow}
                            onClose={() => setShowSlashDropdown(false)}
                            mode={modelState.mode}
                        />
                    )}

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
                                onSlashCommand={handleSlashCommandDetection}
                                isSlashDropdownOpen={showSlashDropdown}
                                onSend={() => {
                                    if ((input.trim() || attachments.length > 0) && !isLoading) {
                                        handleSend();
                                    }
                                }}
                                disabled={isLoading}
                                placeholder={
                                    activeWorkflow
                                        ? `${activeWorkflow.name} mode: Describe what to ${activeWorkflow.id}...`
                                        : attachments.length > 0
                                            ? "Add a message (optional)..."
                                            : "Ask me to do something (type @ to mention tabs, / for workflows)"
                                }
                                autoFocus={true}
                            />                            {/* Animated Preview Overlay - iMessage style */}
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
                            modelState={modelState}
                            onModeChange={onModeChange}
                            onModelChange={onModelChange}
                            showModeDropdown={showModeDropdown}
                            onToggleDropdown={setShowModeDropdown}
                            onError={onError}
                        />

                        {/* Action Buttons - Bottom Right */}
                        <div className="copilot-composer-actions">
                            {/* Voice Input */}
                            <VoiceInput
                                ref={voiceInputRef}
                                onTranscript={(text) => setInput(text)}
                                onRecordingChange={(recording) => {
                                    // Notify parent about recording state for pill UI
                                    onRecordingChange?.(recording);
                                }}
                                onRecordingComplete={(finalText) => {
                                    // Just set the input text, don't auto-send
                                    setInput(finalText);
                                    // Focus the textarea so user can review and send
                                    textareaRef.current?.focus();
                                }}
                                className="copilot-voice-input"
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
