import React, { useState, useEffect } from 'react';
import type { VoiceInputHandle } from '@/audio/VoiceInput';
import type { AIMode, ModelState } from '../../types';
import type { WorkflowDefinition } from '@/workflows/types';
import type { ProcessFileOptions } from '@/hooks/attachments/useFileAttachments';
import { useSearchMode } from '@/hooks/useSearchMode';
import { createLogger } from '~logger';

// Stores
import { useUINavigationStore, useToolsStore, useAttachmentsStore, useCliModeStore, type UINavigationState, type CliModeState } from '@/stores';

// Extracted hooks
import { useScreenshotCapture } from './hooks';

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
    voiceInputRef: React.RefObject<VoiceInputHandle | null>;
    onStop?: () => void;
    pendingMessageId?: string | null;
    nextMessageId?: string;
    modelState: ModelState;
    onModeChange: (mode: AIMode) => void;
    onError?: (message: string, type?: 'error' | 'warning' | 'info') => void;

    // File processing (needed for attachment handlers)
    openFilePicker: () => void;
    processFiles: (files: File[] | ProcessFileOptions[]) => Promise<void>;

    // Workflow
    activeWorkflow: WorkflowDefinition | null;
    showSlashDropdown: boolean;
    slashSearchQuery: string;
    handleSelectWorkflow: (workflow: WorkflowDefinition) => void;
    handleClearWorkflow: () => void;
    handleSlashCommandDetection: (show: boolean, query: string) => void;

    // Attachment action handlers (require processFiles)
    handleAttachLocalPdf: () => void;
    handleAttachYouTubeVideo: () => void;
    handleAttachSelectedText: () => void;

    // Mode dropdown
    showModeDropdown: boolean;
    onToggleModeDropdown: (show: boolean) => void;

    // Refs
    composerRef: React.RefObject<HTMLDivElement | null>;
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
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
    openFilePicker,
    processFiles,
    activeWorkflow,
    showSlashDropdown,
    slashSearchQuery,
    handleSelectWorkflow,
    handleClearWorkflow,
    handleSlashCommandDetection,
    handleAttachLocalPdf,
    handleAttachYouTubeVideo,
    handleAttachSelectedText,
    showModeDropdown,
    onToggleModeDropdown,
    composerRef,
    textareaRef,
}) => {
    // Modal states
    const [showAttachmentDropdown, setShowAttachmentDropdown] = useState(false);
    const [showAddTabsModal, setShowAddTabsModal] = useState(false);
    const [showAddYouTubeVideoModal, setShowAddYouTubeVideoModal] = useState(false);

    // Attachments from store
    const fileAttachments = useAttachmentsStore((s) => s.fileAttachments);
    const tabAttachments = useAttachmentsStore((s) => s.tabAttachments);
    const isDragging = useAttachmentsStore((s) => s.isDragging);
    const addTabAttachments = useAttachmentsStore((s) => s.addTabAttachments);

    // Derived state
    const isLocalMode = modelState.mode === 'local';
    const { isSearchMode, hasApiKey: hasSearchApiKey, isLoading: isSearchLoading, searchDepth } = useSearchMode();
    const isSearchActive = isSearchMode && hasSearchApiKey;

    // Tools state from store - use selective subscriptions to avoid re-render loops
    const showToolsModal = useToolsStore((s) => s.showToolsModal);
    const setShowToolsModal = useToolsStore((s) => s.setShowToolsModal);
    const mcpTools = useToolsStore((s) => s.mcpTools);
    const webMcpToolsCount = useToolsStore((s) => s.webMcpToolsCount);
    const totalEnabledCount = useToolsStore((s) => s.totalEnabledCount);
    const isTooManyTools = useToolsStore((s) => s.isTooManyTools);
    const loadMcpTools = useToolsStore((s) => s.loadMcpTools);
    const recalculateCounts = useToolsStore((s) => s.recalculateCounts);

    const { handleScreenshotClick } = useScreenshotCapture(processFiles);

    // Voice FAB visibility management via store
    const setVoiceFabVisibility = useUINavigationStore((state: UINavigationState) => state.setVoiceFabVisibility);

    // CLI mode - hide FAB when using CLI bridge provider
    const isCliProviderSelected = useCliModeStore((s: CliModeState) => s.isCliProviderSelected);
    const isCliMode = isCliProviderSelected;

    useEffect(() => {
        // Hide FAB when dropdown/attachments/recording are active, or when in CLI mode
        const shouldHide = showAttachmentDropdown || fileAttachments.length > 0 || tabAttachments.length > 0 || isRecording || isCliMode;
        setVoiceFabVisibility(!shouldHide);
    }, [showAttachmentDropdown, fileAttachments.length, tabAttachments.length, isRecording, isCliMode, setVoiceFabVisibility]);

    // Debug logging
    log.info('🎨 Composer render - search mode state', {
        isSearchMode,
        hasSearchApiKey,
        isSearchActive,
        isSearchLoading,
        isLocalMode
    });

    log.debug('Composer render', {
        isLoading,
        attachmentsCount: fileAttachments.length,
        tabAttachmentsCount: tabAttachments.length,
        isSearchActive
    });

    return (
        <div
            ref={composerRef}
            className={`
                flex flex-col overflow-visible relative
                bg-[var(--bg-quaternary)] border border-[var(--border-color)] rounded-[var(--radius-lg)]
                shadow-[var(--shadow-dark)] p-[var(--spacing-sm)]
                transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
                focus-within:border-[var(--border-color-focus)] focus-within:bg-[var(--bg-quinary)] focus-within:shadow-[var(--shadow-glow)]
                ${isRecording ? 'blur-[2px] pointer-events-none' : ''}
                ${isDragging ? 'border-[rgba(99,102,241,0.5)] bg-[rgba(99,102,241,0.05)]' : ''}
            `}
        >
            {/* Drag overlay */}
            <DragOverlay isDragging={isDragging} />

            {/* Suggestions area: Local PDF, YouTube video, and Selected Text */}
            <SuggestionsArea
                onAttachLocalPdf={handleAttachLocalPdf}
                onAttachYouTubeVideo={handleAttachYouTubeVideo}
                onAttachSelectedText={handleAttachSelectedText}
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

            {/* Attachments area: tab and file attachments (uses store) */}
            <AttachmentsArea />

            {/* Main input area with MentionInput */}
            <ComposerInput
                input={input}
                setInput={setInput}
                isLoading={isLoading}
                pendingMessageId={pendingMessageId}
                nextMessageId={nextMessageId}
                activeWorkflow={activeWorkflow}
                attachments={fileAttachments}
                showSlashDropdown={showSlashDropdown}
                handleSlashCommandDetection={handleSlashCommandDetection}
                composerRef={composerRef}
                isSearchActive={isSearchActive}
                searchDepth={searchDepth}
            />

            {/* Bottom section with toolbar (left) and actions (right) */}
            <div className="flex items-end justify-between gap-3">
                {/* Left toolbar: mode selector, tools, search, model */}
                <ComposerToolbar
                    modelState={modelState}
                    onModeChange={onModeChange}
                    showModeDropdown={showModeDropdown}
                    onToggleModeDropdown={onToggleModeDropdown}
                    onError={onError}
                    mcpToolsCount={mcpTools.length}
                    webMcpToolsCount={webMcpToolsCount}
                    totalEnabledCount={totalEnabledCount}
                    isTooManyTools={isTooManyTools}
                    showToolsModal={showToolsModal}
                    setShowToolsModal={setShowToolsModal}
                    loadToolsCount={loadMcpTools}
                    setEnabledToolsCount={recalculateCounts}
                    setMcpToolsCount={recalculateCounts}
                    activeWorkflow={activeWorkflow}
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
                    attachments={fileAttachments}
                    isLocalMode={isLocalMode}
                    isSearchActive={isSearchActive}
                    openFilePicker={openFilePicker}
                    handleScreenshotClick={handleScreenshotClick}
                    handleAddTabAttachments={addTabAttachments}
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
