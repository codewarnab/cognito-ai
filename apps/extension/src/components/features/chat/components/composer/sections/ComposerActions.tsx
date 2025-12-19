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
    voiceInputRef: React.RefObject<VoiceInputHandle | null>;
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
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}



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

    const handleAddTabs = (tabs: Array<{ id: string; title: string; url: string; favIconUrl?: string }>) => {
        handleAddTabAttachments(tabs);
        setShowAttachmentDropdown(false);
    };

    return (
        <div className="flex items-center gap-1.5 shrink-0" style={{ position: 'relative' }}>
            {/* Plus Icon - Attachment Options - Hidden in search mode */}
            {!isSearchActive && (
                <button
                    type="button"
                    className={`
                        bg-transparent border-none cursor-pointer p-2 rounded-full
                        transition-all duration-200 ease-in-out
                        flex items-center justify-center
                        w-9 h-9 min-w-[36px] flex-shrink-0
                        ${isLocalMode
                            ? 'opacity-45 cursor-not-allowed text-white/40'
                            : 'text-white/50 hover:bg-white/10 hover:text-white/85 active:bg-white/12'
                        }
                    `}
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
                    className="
                        bg-[#4a6fa5] text-white border-none rounded-full p-2 cursor-pointer
                        flex items-center justify-center
                        w-9 h-9 min-w-[36px]
                        transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
                        font-semibold
                        hover:bg-[#5a7fb5] hover:scale-110
                        active:scale-95
                    "
                    title="Stop generation"
                >
                    <StopIcon size={16} />
                </button>
            ) : (input.trim() || attachments.length > 0) ? (
                // Show send button when there's input or attachments
                <button
                    type="submit"
                    className="
                        border-none rounded-full p-2 cursor-pointer
                        flex items-center justify-center
                        w-9 h-9 min-w-[36px]
                        transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
                        font-semibold
                        bg-[#4a6fa5] text-white
                        hover:bg-[#4a6fa5] hover:scale-110
                        active:scale-95
                        disabled:opacity-100 disabled:pointer-events-none disabled:text-white/40
                    "
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
                    className="relative"
                />
            )}
        </div>
    );
};

