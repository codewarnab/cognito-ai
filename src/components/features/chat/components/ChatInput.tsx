import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { VoiceInput, type VoiceInputHandle } from '../../../../audio/VoiceInput';
import { ModeSelector } from '../dropdowns/ModeSelector';
import { SendIcon } from '../../../shared/icons';
import { StopIcon } from '../../../shared/icons';
import { PaperclipIcon } from '../../../shared/icons';
import { MentionInput } from '../../../shared/inputs';
import { FileAttachment, type FileAttachmentData } from './FileAttachment';
import { validateFile, createImagePreview, isImageFile } from '../../../../utils/fileProcessor';
import type { AIMode, RemoteModelType, ModelState, Message } from '../types';
import { SlashCommandDropdown } from '../dropdowns/SlashCommandDropdown';
import { WorkflowBadge } from './WorkflowBadge';
import type { WorkflowDefinition } from '../../../../workflows/types';
import { replaceSlashCommand } from '../../../../utils/slashCommandUtils';
import { SuggestedActions } from './SuggestedActions';
import { ContextIndicator } from '../context/ContextIndicator';
import type { AppUsage } from '../../../../ai/types/usage';
import { LocalPdfSuggestion } from './LocalPdfSuggestion';
import { isPdfDismissed, dismissPdf } from '../../../../utils/localPdfDismissals';
import type { LocalPdfInfo } from '../../../../hooks/useActiveTabDetection';

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
    usage?: AppUsage | null; // Token usage tracking
    localPdfInfo?: LocalPdfInfo | null; // Local PDF detection info
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
    onError,
    usage, // Token usage tracking
    localPdfInfo, // Local PDF detection info
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

    // Local PDF attachment state
    const [isAttachingLocalPdf, setIsAttachingLocalPdf] = useState(false);
    const [dismissedPdfPath, setDismissedPdfPath] = useState<string | null>(null);

    // Use external ref if provided, otherwise use local ref
    const voiceInputRef = externalVoiceInputRef || internalVoiceInputRef;

    // Handle file selection
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) {
            return;
        }
        const files = Array.from(e.target.files);
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
        if (!e.clipboardData || !e.clipboardData.files || e.clipboardData.files.length === 0) {
            return;
        }

        // Check if in local mode and show toast (before preventing default)
        if (modelState.mode === 'local') {
            e.preventDefault();
            onError?.('File attachments are not supported in Local mode. Please switch to Cloud mode to attach files.', 'warning');
            return;
        }

        // Prevent default paste behavior when pasting files in cloud mode
        e.preventDefault();

        const files = Array.from(e.clipboardData.files);
        await processFiles(files);
    };

    // Remove attachment
    const handleRemoveAttachment = (id: string) => {
        setAttachments(prev => prev.filter(att => att.id !== id));
    };

    // Handle attaching local PDF (Phase 4 - Integration Complete)
    const handleAttachLocalPdf = async () => {
        if (!localPdfInfo) return;

        setIsAttachingLocalPdf(true);

        try {
            console.log('[ChatInput] Attempting to attach local PDF:', localPdfInfo.filename);

            // Send message to background script to read the file
            const response = await chrome.runtime.sendMessage({
                type: 'READ_LOCAL_PDF',
                payload: {
                    filePath: localPdfInfo.filePath
                }
            });

            if (!response.success) {
                // Handle specific error cases
                if (response.needsPermission) {
                    // Show permission guide
                    const { FileAccessError } = await import('../../../../errors');
                    const helpText = FileAccessError.getPermissionHelpText();
                    onError?.(
                        `${response.error}\n\n${helpText}`,
                        'warning'
                    );
                } else {
                    // Generic error with fallback suggestion
                    onError?.(
                        `${response.error}\n\nYou can try manually uploading the PDF using the attachment button.`,
                        'error'
                    );
                }
                return;
            }

            // Successfully read the file - convert base64 to Blob
            // The background script sends base64 instead of ArrayBuffer because
            // ArrayBuffers don't serialize properly through Chrome messaging
            const { base64Data, filename, type } = response.data;

            // Decode base64 to binary string
            const binaryString = atob(base64Data);

            // Convert binary string to Uint8Array
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // Create Blob from bytes
            const blob = new Blob([bytes], { type: type || 'application/pdf' });

            // Create File object from Blob
            const file = new File([blob], filename, {
                type: type || 'application/pdf',
                lastModified: Date.now()
            });

            console.log('[ChatInput] Successfully created File object:', {
                name: file.name,
                size: file.size,
                type: file.type
            });

            // Use existing processFiles function to handle the attachment
            await processFiles([file]);

            // Auto-dismiss suggestion after successful attachment
            handleDismissLocalPdf();

            // Show success message
            onError?.(`Attached ${filename.length > 20 ? filename.substring(0, 20) + '...' : filename}`, 'info');

        } catch (error) {
            console.error('[ChatInput] Error attaching local PDF:', error);
            onError?.(
                'Failed to attach PDF. Please try manual upload using the attachment button.',
                'error'
            );
        } finally {
            setIsAttachingLocalPdf(false);
        }
    };

    // Handle dismissing the local PDF suggestion
    const handleDismissLocalPdf = () => {
        if (!localPdfInfo) return;

        // Mark as dismissed in localStorage
        dismissPdf(localPdfInfo.filePath);

        // Update local state to hide the badge immediately
        setDismissedPdfPath(localPdfInfo.filePath);
    };

    // Handle send with attachments
    const handleSend = () => {
        if (!input.trim() && attachments.length === 0) return;

        // Check word count limit for local mode
        if (modelState.mode === 'local') {
            // Count total words in all messages + current input
            let totalWords = 0;

            // Count words in existing messages
            for (const msg of messages) {
                if (msg.parts && msg.parts.length > 0) {
                    for (const part of msg.parts) {
                        if (part.type === 'text' && part.text) {
                            totalWords += part.text.split(/\s+/).filter((word: string) => word.length > 0).length;
                        }
                    }
                }
            }

            // Count words in current input
            totalWords += input.split(/\s+/).filter((word: string) => word.length > 0).length;

            const WORD_LIMIT = 500;

            if (totalWords > WORD_LIMIT) {
                // Show toast notification
                onError?.(
                    `⚠️ Input too large for Local Mode. Your conversation has ${totalWords} words (limit: ${WORD_LIMIT} words). Please start a new conversation or switch to Remote Mode for unlimited context.`,
                    'warning'
                );
                return; // Don't send the message
            }
        }

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
    }, [modelState.mode, onError]);

    const handleSuggestionClick = (action: string) => {
        setInput(action);
        textareaRef.current?.focus();
    };

    const isLocalMode = modelState.mode === 'local';

    // Check if we should show the local PDF suggestion
    const shouldShowLocalPdfSuggestion =
        localPdfInfo &&
        !isLocalMode && // Don't show in local mode (attachments not supported)
        !isPdfDismissed(localPdfInfo.filePath) &&
        dismissedPdfPath !== localPdfInfo.filePath;

    return (
        <div className="copilot-input-container">


            {/* Suggested Actions */}
            <SuggestedActions
                messages={messages}
                input={input}
                isLoading={isLoading}
                activeWorkflow={activeWorkflow}
                attachments={attachments}
                isRecording={isRecording}
                modelState={modelState}
                onSuggestionClick={handleSuggestionClick}
            />

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
                    {/* Local PDF Suggestion - shows when local PDF is detected */}
                    {shouldShowLocalPdfSuggestion && (
                        <LocalPdfSuggestion
                            filename={localPdfInfo.filename}
                            onAttach={handleAttachLocalPdf}
                            onDismiss={handleDismissLocalPdf}
                            isLoading={isAttachingLocalPdf}
                        />
                    )}

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
                                className={`copilot-action-button ${isLocalMode ? 'disabled' : ''}`}
                                title={isLocalMode ? 'Switch to Cloud mode to use file attachments' : 'Attach file (Images, PDFs, Documents)'}
                                tabIndex={-1}
                                aria-disabled={isLocalMode}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (isLocalMode) {
                                        // Do not open file picker in local mode
                                        return;
                                    }
                                    fileInputRef.current?.click();
                                }}
                                onMouseEnter={() => {
                                    if (!isLocalMode) paperclipIconRef.current?.startAnimation();
                                }}
                                onMouseLeave={() => {
                                    if (!isLocalMode) paperclipIconRef.current?.stopAnimation();
                                }}
                            >
                                <PaperclipIcon ref={paperclipIconRef} size={16} />
                            </button>

                            {/* Context Indicator - Shows token usage (Cloud mode only) */}
                            {!isLocalMode && usage && (
                                <ContextIndicator usage={usage} className="context-indicator-input" />
                            )}

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
