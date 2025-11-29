import React, { useRef } from 'react';
import { VoiceInput, type VoiceInputHandle } from '@/audio/VoiceInput';
import { SendIcon, StopIcon } from '@/components/shared/icons';
import { PlusIcon, type PlusIconHandle } from '@assets/icons/ui/plus';
import { AttachmentDropdown } from '../../attachments/AttachmentDropdown';
import { AddTabsModal } from '../../modals/AddTabsModal';
import { AddYouTubeVideoModal } from '../../modals/AddYouTubeVideoModal';
import type { FileAttachmentData } from '../../attachments/FileAttachment';
import type { TabAttachmentData } from '../../attachments/TabAttachment';
import type { ProcessFileOptions } from '@/hooks/attachments/useFileAttachments';

interface ComposerActionsProps {
    input: string;
    setInput: (value: string) => void;
    isLoading: boolean;
    isRecording?: boolean;
    onRecordingChange?: (isRecording: boolean) => void;
    voiceInputRef: React.RefObject<VoiceInputHandle>;
    onStop?: () => void;
    attachments: FileAttachmentData[];
    isLocalMode: boolean;
    isSearchActive: boolean;
    // Attachment handlers
    openFilePicker: () => void;
    handleScreenshotClick: () => Promise<void>;
    handleAddTabAttachments: (tabs: TabAttachmentData[]) => void;
    processFiles: (files: ProcessFileOptions[]) => Promise<void>;
    onError?: (message: string, type?: 'error' | 'warning' | 'info') => void;
    // Modal states
    showAttachmentDropdown: boolean;
    setShowAttachmentDropdown: (show: boolean) => void;
    showAddTabsModal: boolean;
    setShowAddTabsModal: (show: boolean) => void;
    showAddYouTubeVideoModal: boolean;
    setShowAddYouTubeVideoModal: (show: boolean) => void;
    // Refs
    textareaRef: React.RefObject<HTMLTextAreaElement>;
}

import { createLogger } from '~logger';

const log = createLogger('ComposerActions', 'AI_CHAT');

/**
 * Right side action buttons: plus icon for attachments, voice/send/stop buttons.
 */
export const ComposerActions: React.FC<ComposerActionsProps> = ({
    input,
    setInput,
    isLoading,
    // isRecording,
    onRecordingChange,
    voiceInputRef,
    onStop,
    attachments,
    isLocalMode,
    isSearchActive,
    openFilePicker,
    handleScreenshotClick,
    handleAddTabAttachments,
    processFiles,
    onError,
    showAttachmentDropdown,
    setShowAttachmentDropdown,
    showAddTabsModal,
    setShowAddTabsModal,
    showAddYouTubeVideoModal,
    setShowAddYouTubeVideoModal,
    textareaRef
}) => {
    const plusIconRef = useRef<PlusIconHandle>(null);

    // Debug logging for attachment button visibility
    log.info('🔘 ComposerActions render', {
        isSearchActive,
        isLocalMode,
        showPlusButton: !isSearchActive
    });

    const handleAddTabs = (tabs: Array<{ id: string; title: string; url: string; favIconUrl?: string }>) => {
        handleAddTabAttachments(tabs);
        setShowAttachmentDropdown(false);
    };

    return (
        <div className="copilot-composer-actions" style={{ position: 'relative' }}>
            {/* Plus Icon - Attachment Options - Hidden in search mode */}
            {!isSearchActive && (
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
            )}

            {/* Attachment Dropdown - Also hidden in search mode */}
            {showAttachmentDropdown && !isSearchActive && (
                <AttachmentDropdown
                    onFileClick={openFilePicker}
                    onScreenshotClick={handleScreenshotClick}
                    onAddTabsClick={() => setShowAddTabsModal(true)}
                    onAddYouTubeVideoClick={() => setShowAddYouTubeVideoModal(true)}
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

            {/* Add YouTube Video Modal */}
            <AddYouTubeVideoModal
                isOpen={showAddYouTubeVideoModal}
                onClose={() => setShowAddYouTubeVideoModal(false)}
                processFiles={processFiles}
                onError={onError}
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
    );
};

