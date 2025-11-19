import React, { useRef, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { VoiceInput, type VoiceInputHandle } from '../../../../audio/VoiceInput';
import { ModeSelector } from '../dropdowns/ModeSelector';
import { SendIcon } from '../../../shared/icons';
import { StopIcon } from '../../../shared/icons';
import { PaperclipIcon } from '../../../shared/icons';
import { UploadIconMinimal } from '../../../shared/icons';
import { MentionInput } from '../../../shared/inputs';
import { FileAttachment, type FileAttachmentData } from './FileAttachment';
import type { AIMode, RemoteModelType, ModelState, Message } from '../types';
import { SlashCommandDropdown } from '../dropdowns/SlashCommandDropdown';
import { WorkflowBadge } from './WorkflowBadge';
import { SuggestedActions } from './SuggestedActions';
import { ContextIndicator } from '../context/ContextIndicator';
import type { AppUsage } from '../../../../ai/types/usage';
import { LocalPdfSuggestion } from './LocalPdfSuggestion';
import type { LocalPdfInfo } from '../../../../hooks/useActiveTabDetection';
import { HIDE_LOCAL_MODE } from '../../../../constants';
import { useFileAttachments } from '../../../../hooks/useFileAttachments';
import { useLocalPdfAttachment } from '../../../../hooks/useLocalPdfAttachment';
import { useWorkflowMode } from '../../../../hooks/useWorkflowMode';
import { useChatInputValidation } from '../../../../hooks/useChatInputValidation';

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
    const paperclipIconRef = useRef<any>(null);
    const composerRef = useRef<HTMLDivElement>(null);
    const internalVoiceInputRef = useRef<VoiceInputHandle>(null);
    const [showModeDropdown, setShowModeDropdown] = useState(false);

    // Use external ref if provided, otherwise use local ref
    const voiceInputRef = externalVoiceInputRef || internalVoiceInputRef;

    // Custom hooks for separated concerns
    const {
        attachments,
        isDragging,
        fileInputRef,
        processFiles,
        handleFileChange,
        handlePaste,
        handleRemoveAttachment,
        clearAttachments,
        openFilePicker,
        dragHandlers,
    } = useFileAttachments({ mode: modelState.mode, onError });

    const {
        isAttachingLocalPdf,
        shouldShowLocalPdfSuggestion,
        handleAttachLocalPdf,
        handleDismissLocalPdf,
    } = useLocalPdfAttachment({
        localPdfInfo,
        mode: modelState.mode,
        onError,
        processFiles,
    });

    const {
        activeWorkflow,
        showSlashDropdown,
        slashSearchQuery,
        handleSelectWorkflow,
        handleClearWorkflow,
        handleSlashCommandDetection,
    } = useWorkflowMode({ input, setInput, onError });

    const { validateBeforeSend } = useChatInputValidation({
        mode: modelState.mode,
        messages,
        onError,
    });

    // Handle send with attachments and workflow
    const handleSend = () => {
        // Validate input before sending
        if (!validateBeforeSend(input, attachments)) {
            return;
        }

        // If workflow is active, add workflow metadata to message
        if (activeWorkflow) {
            onSendMessage(input, attachments, activeWorkflow.id);
            handleClearWorkflow();
        } else {
            onSendMessage(input, attachments);
        }

        setInput('');
        clearAttachments();
    };

    // Add paste event listener for file pasting
    useEffect(() => {
        const composerElement = composerRef.current;
        if (!composerElement) return;

        composerElement.addEventListener('paste', handlePaste as any);

        return () => {
            composerElement.removeEventListener('paste', handlePaste as any);
        };
    }, [handlePaste]);

    // Hide voice-mode-fab when there's text in input
    useEffect(() => {
        const voiceFab = document.querySelector('.voice-mode-fab') as HTMLElement;
        if (voiceFab) {
            voiceFab.style.visibility = input.trim() ? 'hidden' : '';
        }
    }, [input]);

    const handleSuggestionClick = (action: string) => {
        setInput(action);
        textareaRef.current?.focus();
    };

    const isLocalMode = modelState.mode === 'local';

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
                {...dragHandlers}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*,audio/*,.pdf,.txt,.md,.markdown,.doc,.docx,.xls,.xlsx,.csv,.json,.xml,.yaml,.yml,.log,.html,.htm,.css,.scss,.sass,.less,.js,.jsx,.ts,.tsx,.py,.java,.cpp,.c,.h,.cs,.php,.rb,.ruby,.sh,.bash,.go,.rs,.swift,.zip,.rar,.7z,.tar,.gz"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                />

                <div ref={composerRef} className={`copilot-composer ${isRecording ? 'recording-blur' : ''} ${isDragging ? 'dragging' : ''}`}>
                    {/* Drag overlay */}
                    {isDragging && (
                        <div className="drag-overlay">
                            <div className="drag-overlay-content">
                                <UploadIconMinimal size={32} />
                                <p>Drop files to attach</p>
                            </div>
                        </div>
                    )}

                    {/* Local PDF Suggestion - shows when local PDF is detected */}
                    {shouldShowLocalPdfSuggestion && localPdfInfo && (
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
                            onClose={() => handleSlashCommandDetection(false, '')}
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
                                            : "Ask anything (type @ to mention tabs, / for workflows)"
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
                        <div className="copilot-composer-left">
                            {!HIDE_LOCAL_MODE && (
                                <ModeSelector
                                    modelState={modelState}
                                    onModeChange={onModeChange}
                                    showModeDropdown={showModeDropdown}
                                    onToggleDropdown={setShowModeDropdown}
                                    onError={onError}
                                />
                            )}
                        </div>

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
                                    openFilePicker();
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
                            {/* {!isLocalMode && usage && (
                                <ContextIndicator usage={usage} className="context-indicator-input" />
                            )} */}

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
