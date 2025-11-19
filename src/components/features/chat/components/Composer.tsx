import React, { useRef, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { VoiceInput, type VoiceInputHandle } from '../../../../audio/VoiceInput';
import { ModeSelector } from '../dropdowns/ModeSelector';
import { SendIcon, StopIcon, UploadIconMinimal } from '../../../shared/icons';
import { PlusIcon, type PlusIconHandle } from '../../../../../assets/icons/ui/plus';
import { MentionInput } from '../../../shared/inputs';
import { FileAttachment, type FileAttachmentData } from './FileAttachment';
import { TabAttachment, type TabAttachmentData } from './TabAttachment';
import { AttachmentDropdown } from './AttachmentDropdown';
import { AddTabsModal } from './AddTabsModal';
import type { AIMode, ModelState } from '../types';
import { SlashCommandDropdown } from '../dropdowns/SlashCommandDropdown';
import { WorkflowBadge } from './WorkflowBadge';
import { LocalPdfSuggestion } from './LocalPdfSuggestion';
import type { LocalPdfInfo } from '../../../../hooks/useActiveTabDetection';
import { HIDE_LOCAL_MODE } from '../../../../constants';
import type { WorkflowDefinition } from '../../../../workflows/types';
import { createLogger } from '~logger';

const log = createLogger('Composer', 'AI_CHAT');

interface ComposerProps {
    input: string;
    setInput: (value: string) => void;
    isLoading: boolean;
    isRecording?: boolean;
    onRecordingChange?: (isRecording: boolean) => void;
    voiceInputRef: React.RefObject<VoiceInputHandle>;
    onStop?: () => void;
    pendingMessageId?: string | null;
    nextMessageId?: string;
    modelState: ModelState;
    onModeChange: (mode: AIMode) => void;
    onError?: (message: string, type?: 'error' | 'warning' | 'info') => void;

    // File attachments
    attachments: FileAttachmentData[];
    isDragging: boolean;
    openFilePicker: () => void;
    handleRemoveAttachment: (id: string) => void;
    processFiles: (files: File[]) => Promise<void>;

    // Tab attachments
    tabAttachments: TabAttachmentData[];
    handleRemoveTabAttachment: (id: string) => void;
    handleAddTabAttachments: (tabs: TabAttachmentData[]) => void;

    // Workflow
    activeWorkflow: WorkflowDefinition | null;
    showSlashDropdown: boolean;
    slashSearchQuery: string;
    handleSelectWorkflow: (workflow: WorkflowDefinition) => void;
    handleClearWorkflow: () => void;
    handleSlashCommandDetection: (show: boolean, query: string) => void;

    // Local PDF
    localPdfInfo?: LocalPdfInfo | null;
    shouldShowLocalPdfSuggestion: boolean;
    isAttachingLocalPdf: boolean;
    handleAttachLocalPdf: () => void;
    handleDismissLocalPdf: () => void;

    // Mode dropdown
    showModeDropdown: boolean;
    onToggleModeDropdown: (show: boolean) => void;

    // Refs
    composerRef: React.RefObject<HTMLDivElement>;
    textareaRef: React.RefObject<HTMLTextAreaElement>;
}

export const Composer: React.FC<ComposerProps> = ({
    input,
    setInput,
    isLoading,
    isRecording,
    onRecordingChange,
    voiceInputRef,
    onStop,
    pendingMessageId,
    nextMessageId,
    modelState,
    onModeChange,
    onError,
    attachments,
    isDragging,
    openFilePicker,
    handleRemoveAttachment,
    processFiles,
    tabAttachments,
    handleRemoveTabAttachment,
    handleAddTabAttachments,
    activeWorkflow,
    showSlashDropdown,
    slashSearchQuery,
    handleSelectWorkflow,
    handleClearWorkflow,
    handleSlashCommandDetection,
    localPdfInfo,
    shouldShowLocalPdfSuggestion,
    isAttachingLocalPdf,
    handleAttachLocalPdf,
    handleDismissLocalPdf,
    showModeDropdown,
    onToggleModeDropdown,
    composerRef,
    textareaRef,
}) => {
    const plusIconRef = useRef<PlusIconHandle>(null);
    const [showAttachmentDropdown, setShowAttachmentDropdown] = useState(false);
    const [showAddTabsModal, setShowAddTabsModal] = useState(false);
    const isLocalMode = modelState.mode === 'local';

    // Hide voice-mode-fab when attachment dropdown is open or when there are attachments
    useEffect(() => {
        const voiceFab = document.querySelector('.voice-mode-fab') as HTMLElement;
        if (voiceFab) {
            if (showAttachmentDropdown || attachments.length > 0) {
                voiceFab.style.visibility = 'hidden';
            } else {
                voiceFab.style.visibility = '';
            }
        }
    }, [showAttachmentDropdown, attachments.length]);

    const handleScreenshotClick = async () => {
        try {
            log.info('Taking screenshot...');

            // Get active tab
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];

            if (!tab || !tab.id || !tab.windowId) {
                log.error('No active tab found');
                return;
            }

            // Capture screenshot
            const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });

            // Convert data URL to File
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            const file = new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' });

            // Process the file using the existing file attachment logic
            await processFiles([file]);

            log.info('Screenshot captured and attached');
        } catch (error) {
            log.error('Failed to capture screenshot:', error);
        }
    };

    const handleAddTabs = (tabs: Array<{ id: string; title: string; url: string; favIconUrl?: string }>) => {
        log.info('Adding tabs:', tabs);
        handleAddTabAttachments(tabs);
        setShowAttachmentDropdown(false);
    };

    return (
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

            {/* Tab Attachments Preview */}
            {tabAttachments.length > 0 && (
                <div className="tab-attachments-container">
                    <TabAttachment
                        tabs={tabAttachments}
                        onRemove={handleRemoveTabAttachment}
                        onRemoveAll={() => {
                            tabAttachments.forEach(tab => handleRemoveTabAttachment(tab.id));
                        }}
                    />
                </div>
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
                            // Trigger form submit by clicking the submit button
                            const form = composerRef.current?.closest('form');
                            if (form) {
                                form.requestSubmit();
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
                <div className="copilot-composer-left">
                    {!HIDE_LOCAL_MODE && (
                        <ModeSelector
                            modelState={modelState}
                            onModeChange={onModeChange}
                            showModeDropdown={showModeDropdown}
                            onToggleDropdown={onToggleModeDropdown}
                            onError={onError}
                        />
                    )}
                </div>

                {/* Action Buttons - Bottom Right */}
                <div className="copilot-composer-actions" style={{ position: 'relative' }}>
                    {/* Plus Icon - Attachment Options */}
                    <button
                        type="button"
                        className={`copilot-action-button ${isLocalMode ? 'disabled' : ''}`}
                        title={isLocalMode ? 'Switch to Cloud mode to use attachments' : 'Attach file or screenshot'}
                        tabIndex={-1}
                        aria-disabled={isLocalMode}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (isLocalMode) {
                                return;
                            }
                            setShowAttachmentDropdown(!showAttachmentDropdown);
                        }}
                        onMouseEnter={() => {
                            if (!isLocalMode) plusIconRef.current?.startAnimation();
                        }}
                        onMouseLeave={() => {
                            if (!isLocalMode) plusIconRef.current?.stopAnimation();
                        }}
                    >
                        <PlusIcon ref={plusIconRef} size={16} />
                    </button>

                    {/* Attachment Dropdown */}
                    {showAttachmentDropdown && (
                        <AttachmentDropdown
                            onFileClick={openFilePicker}
                            onScreenshotClick={handleScreenshotClick}
                            onAddTabsClick={() => setShowAddTabsModal(true)}
                            onClose={() => setShowAttachmentDropdown(false)}
                            isLocalMode={isLocalMode}
                        />
                    )}

                    {/* Add Tabs Modal */}
                    <AddTabsModal
                        isOpen={showAddTabsModal}
                        onClose={() => setShowAddTabsModal(false)}
                        onAddTabs={handleAddTabs}
                    />

                    {/* Voice Input OR Send Button OR Stop Button - only one shows at a time */}
                    {isLoading && onStop ? (
                        // Show stop button when streaming
                        <button
                            type="button"
                            onClick={onStop}
                            className="copilot-stop-button-sm"
                            title="Stop generation"
                        >
                            <StopIcon size={16} />
                        </button>
                    ) : (input.trim() || attachments.length > 0) ? (
                        // Show send button when there's input or attachments
                        <button
                            type="submit"
                            className="copilot-send-button-sm"
                            title="Send message (Enter)"
                            disabled={(!input.trim() && attachments.length === 0) || isLoading}
                        >
                            <SendIcon size={18} />
                        </button>
                    ) : (
                        // Show voice button when input is empty
                        <VoiceInput
                            ref={voiceInputRef}
                            onTranscript={(text) => setInput(text)}
                            onRecordingChange={(recording) => {
                                onRecordingChange?.(recording);
                            }}
                            onRecordingComplete={(finalText) => {
                                setInput(finalText);
                                textareaRef.current?.focus();
                            }}
                            className="copilot-voice-input"
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
