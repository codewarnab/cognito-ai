import React, { useState } from 'react';
import type { VoiceInputHandle } from '@/audio/VoiceInput';
import type { FileAttachmentData } from '../attachments/FileAttachment';
import type { TabAttachmentData } from '../attachments/TabAttachment';
import type { AIMode, ModelState } from '../../types';
import type { WorkflowDefinition } from '@/workflows/types';
import type { LocalPdfInfo, YouTubeVideoInfo } from '@/hooks/browser';
import type { YouTubeVideoMetadata } from '@/hooks/attachments/useYouTubeVideoAttachment';
import type { ProcessFileOptions } from '@/hooks/attachments/useFileAttachments';
import { useSearchMode } from '@/hooks/useSearchMode';
import { createLogger } from '~logger';

// Extracted hooks
import { useToolsCount, useVoiceFabVisibility, useScreenshotCapture } from './hooks';

// Extracted section components
import {
    DragOverlay,
    SuggestionsArea,
    WorkflowSection,
    AttachmentsArea,
    ComposerInput,
    ComposerToolbar,
    ComposerActions
} from './sections';

const log = createLogger('Composer', 'AI_CHAT');

export interface ComposerProps {
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
    processFiles: (files: File[] | ProcessFileOptions[]) => Promise<void>;

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

    // YouTube Video
    youtubeVideoInfo?: YouTubeVideoInfo | null;
    shouldShowYouTubeVideoSuggestion: boolean;
    isAttachingVideo: boolean;
    isFetchingInBackground?: boolean;
    handleAttachYouTubeVideo: () => void;
    handleDismissYouTubeVideo: () => void;
    videoMetadata?: YouTubeVideoMetadata | null;

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
    youtubeVideoInfo,
    shouldShowYouTubeVideoSuggestion,
    isAttachingVideo,
    isFetchingInBackground,
    handleAttachYouTubeVideo,
    handleDismissYouTubeVideo,
    videoMetadata,
    showModeDropdown,
    onToggleModeDropdown,
    composerRef,
    textareaRef,
}) => {
    // Modal states
    const [showAttachmentDropdown, setShowAttachmentDropdown] = useState(false);
    const [showAddTabsModal, setShowAddTabsModal] = useState(false);
    const [showAddYouTubeVideoModal, setShowAddYouTubeVideoModal] = useState(false);
    const [showToolsModal, setShowToolsModal] = useState(false);

    // Derived state
    const isLocalMode = modelState.mode === 'local';
    const { isSearchMode, hasApiKey: hasSearchApiKey, isLoading: isSearchLoading, searchDepth } = useSearchMode();
    const isSearchActive = isSearchMode && hasSearchApiKey;

    // Custom hooks
    const toolsState = useToolsCount();
    const { handleScreenshotClick } = useScreenshotCapture(processFiles);

    // Voice FAB visibility management
    useVoiceFabVisibility(showAttachmentDropdown, attachments.length, tabAttachments.length);

    // Debug logging for search mode state
    log.info('🎨 Composer render - search mode state', {
        isSearchMode,
        hasSearchApiKey,
        isSearchActive,
        isSearchLoading,
        isLocalMode
    });

    log.debug('Composer render', {
        isLoading,
        attachmentsCount: attachments.length,
        tabAttachmentsCount: tabAttachments.length,
        isSearchActive
    });

    return (
        <div
            ref={composerRef}
            className={`copilot-composer ${isRecording ? 'recording-blur' : ''} ${isDragging ? 'dragging' : ''}`}
        >
            {/* Drag overlay */}
            <DragOverlay isDragging={isDragging} />

            {/* Suggestions area: Local PDF and YouTube video */}
            <SuggestionsArea
                localPdfInfo={localPdfInfo}
                shouldShowLocalPdfSuggestion={shouldShowLocalPdfSuggestion}
                isAttachingLocalPdf={isAttachingLocalPdf}
                handleAttachLocalPdf={handleAttachLocalPdf}
                handleDismissLocalPdf={handleDismissLocalPdf}
                youtubeVideoInfo={youtubeVideoInfo}
                shouldShowYouTubeVideoSuggestion={shouldShowYouTubeVideoSuggestion}
                isAttachingVideo={isAttachingVideo}
                isFetchingInBackground={isFetchingInBackground}
                handleAttachYouTubeVideo={handleAttachYouTubeVideo}
                handleDismissYouTubeVideo={handleDismissYouTubeVideo}
                videoMetadata={videoMetadata}
            />

            {/* Workflow section: badge and slash command dropdown */}
            <WorkflowSection
                activeWorkflow={activeWorkflow}
                showSlashDropdown={showSlashDropdown}
                slashSearchQuery={slashSearchQuery}
                handleSelectWorkflow={handleSelectWorkflow}
                handleClearWorkflow={handleClearWorkflow}
                handleSlashCommandDetection={handleSlashCommandDetection}
                mode={modelState.mode}
            />

            {/* Attachments area: tab and file attachments */}
            <AttachmentsArea
                attachments={attachments}
                tabAttachments={tabAttachments}
                handleRemoveAttachment={handleRemoveAttachment}
                handleRemoveTabAttachment={handleRemoveTabAttachment}
            />

            {/* Main input area with MentionInput */}
            <ComposerInput
                input={input}
                setInput={setInput}
                isLoading={isLoading}
                pendingMessageId={pendingMessageId}
                nextMessageId={nextMessageId}
                activeWorkflow={activeWorkflow}
                attachments={attachments}
                showSlashDropdown={showSlashDropdown}
                handleSlashCommandDetection={handleSlashCommandDetection}
                composerRef={composerRef}
                isSearchActive={isSearchActive}
                searchDepth={searchDepth}
            />

            {/* Bottom section with toolbar (left) and actions (right) */}
            <div className="copilot-composer-bottom">
                {/* Left toolbar: mode selector, tools, search, model */}
                <ComposerToolbar
                    modelState={modelState}
                    onModeChange={onModeChange}
                    showModeDropdown={showModeDropdown}
                    onToggleModeDropdown={onToggleModeDropdown}
                    onError={onError}
                    mcpToolsCount={toolsState.mcpToolsCount}
                    webMcpToolsCount={toolsState.webMcpToolsCount}
                    totalEnabledCount={toolsState.totalEnabledCount}
                    isTooManyTools={toolsState.isTooManyTools}
                    showToolsModal={showToolsModal}
                    setShowToolsModal={setShowToolsModal}
                    loadToolsCount={toolsState.loadToolsCount}
                    setEnabledToolsCount={toolsState.setEnabledToolsCount}
                    setMcpToolsCount={toolsState.setMcpToolsCount}
                    activeWorkflow={activeWorkflow}
                    isSearchActive={isSearchActive}
                />

                {/* Right actions: attachments, voice/send/stop */}
                <ComposerActions
                    input={input}
                    setInput={setInput}
                    isLoading={isLoading}
                    isRecording={isRecording}
                    onRecordingChange={onRecordingChange}
                    voiceInputRef={voiceInputRef}
                    onStop={onStop}
                    attachments={attachments}
                    isLocalMode={isLocalMode}
                    isSearchActive={isSearchActive}
                    openFilePicker={openFilePicker}
                    handleScreenshotClick={handleScreenshotClick}
                    handleAddTabAttachments={handleAddTabAttachments}
                    processFiles={processFiles}
                    onError={onError}
                    showAttachmentDropdown={showAttachmentDropdown}
                    setShowAttachmentDropdown={setShowAttachmentDropdown}
                    showAddTabsModal={showAddTabsModal}
                    setShowAddTabsModal={setShowAddTabsModal}
                    showAddYouTubeVideoModal={showAddYouTubeVideoModal}
                    setShowAddYouTubeVideoModal={setShowAddYouTubeVideoModal}
                    textareaRef={textareaRef}
                />
            </div>
        </div>
    );
};
