import React, { createContext, useContext } from 'react';
import type { VoiceInputHandle } from '@/audio/VoiceInput';
import type { FileAttachmentData } from '../attachments/FileAttachment';
import type { TabAttachmentData } from '../attachments/TabAttachment';
import type { AIMode, ModelState } from '../../types';
import type { WorkflowDefinition } from '@/workflows/types';
import type { LocalPdfInfo, YouTubeVideoInfo } from '@/hooks/browser';
import type { YouTubeVideoMetadata } from '@/hooks/attachments/useYouTubeVideoAttachment';
import type { ProcessFileOptions } from '@/hooks/attachments/useFileAttachments';

export interface ComposerContextValue {
    // Input state
    input: string;
    setInput: (value: string) => void;
    isLoading: boolean;

    // Recording state
    isRecording?: boolean;
    onRecordingChange?: (isRecording: boolean) => void;
    voiceInputRef: React.RefObject<VoiceInputHandle>;

    // Stop handling
    onStop?: () => void;
    pendingMessageId?: string | null;
    nextMessageId?: string;

    // Model state
    modelState: ModelState;
    onModeChange: (mode: AIMode) => void;
    onError?: (message: string, type?: 'error' | 'warning' | 'info') => void;
    isLocalMode: boolean;
    isSearchActive: boolean;

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

    // Tools state (from useToolsCount hook)
    enabledToolsCount: number;
    mcpToolsCount: number;
    totalEnabledCount: number;
    isTooManyTools: boolean;
    loadToolsCount: () => Promise<void>;

    // Modal states
    showToolsModal: boolean;
    setShowToolsModal: (show: boolean) => void;
    showAttachmentDropdown: boolean;
    setShowAttachmentDropdown: (show: boolean) => void;
    showAddTabsModal: boolean;
    setShowAddTabsModal: (show: boolean) => void;

    // Actions
    handleScreenshotClick: () => Promise<void>;
    handleAddTabs: (tabs: Array<{ id: string; title: string; url: string; favIconUrl?: string }>) => void;
    setEnabledToolsCount: (count: number) => void;
    setMcpToolsCount: (count: number) => void;
}

const ComposerContext = createContext<ComposerContextValue | null>(null);

export const ComposerProvider: React.FC<{
    value: ComposerContextValue;
    children: React.ReactNode;
}> = ({ value, children }) => {
    return (
        <ComposerContext.Provider value={value}>
            {children}
        </ComposerContext.Provider>
    );
};

export const useComposer = (): ComposerContextValue => {
    const context = useContext(ComposerContext);
    if (!context) {
        throw new Error('useComposer must be used within a ComposerProvider');
    }
    return context;
};

