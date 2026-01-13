import React, { useRef, useState, useEffect, useCallback } from 'react';
import { type VoiceInputHandle } from '@/audio/VoiceInput';
import { Composer } from './Composer';
import { ComposerHeader } from './sections';
import type { AIMode, RemoteModelType, ModelState, Message } from '../../types';
import type { AppUsage } from '@/ai/types/usage';
import type { LocalPdfInfo } from '@/hooks/browser';
import { useFileAttachments, useYouTubeVideoAttachment } from '@/hooks/attachments';
import { useYouTubeVideoDetection, useSelectedTextDetection } from '@/hooks/browser';
import { useWorkflowMode } from '@/hooks/workflows';
import { useSearchMode } from '@/hooks/useSearchMode';
import { useChatInputValidation } from '@/hooks/chat';
import { useUINavigationStore, useAttachmentsStore } from '@/stores';

interface ChatInputProps {
    messages: Message[];
    input: string;
    setInput: (value: string) => void;
    onSendMessage: (
        messageText?: string,
        attachments?: Array<{ id: string; file: File; preview?: string; type: string }>,
        tabAttachments?: Array<{ id: string; title: string; url: string; favIconUrl?: string }>,
        workflowId?: string
    ) => void;
    isLoading: boolean;
    isRecording?: boolean;
    onRecordingChange?: (isRecording: boolean) => void;
    voiceInputRef?: React.RefObject<VoiceInputHandle | null>;
    onStop?: () => void;
    pendingMessageId?: string | null;
    nextMessageId?: string;
    modelState: ModelState;
    onModeChange: (mode: AIMode) => void;
    onModelChange: (model: RemoteModelType) => void;
    onApiKeySaved?: () => void;
    onError?: (message: string, type?: 'error' | 'warning' | 'info') => void;
    usage?: AppUsage | null;
    localPdfInfo?: LocalPdfInfo | null;
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
    localPdfInfo,
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const composerRef = useRef<HTMLDivElement>(null);
    const internalVoiceInputRef = useRef<VoiceInputHandle>(null);
    const [showModeDropdown, setShowModeDropdown] = useState(false);

    // Use external ref if provided, otherwise use local ref
    const voiceInputRef = externalVoiceInputRef || internalVoiceInputRef;

    // Attachments store
    const fileAttachments = useAttachmentsStore((s) => s.fileAttachments);
    const tabAttachments = useAttachmentsStore((s) => s.tabAttachments);
    const clearForNewMessage = useAttachmentsStore((s) => s.clearForNewMessage);
    const setIsDragging = useAttachmentsStore((s) => s.setIsDragging);

    // Local PDF store state
    const setLocalPdfInfo = useAttachmentsStore((s) => s.setLocalPdfInfo);
    const setIsAttachingLocalPdf = useAttachmentsStore((s) => s.setIsAttachingLocalPdf);

    // YouTube store state
    const setYouTubeVideoInfo = useAttachmentsStore((s) => s.setYouTubeVideoInfo);

    // Selected text store state
    const setSelectedTextInfo = useAttachmentsStore((s) => s.setSelectedTextInfo);
    const setIsAttachingSelectedText = useAttachmentsStore((s) => s.setIsAttachingSelectedText);
    const dismissSelectedText = useAttachmentsStore((s) => s.dismissSelectedText);

    // File attachments hook (for processFiles and file input handling)
    const {
        fileInputRef,
        processFiles,
        handleFileChange,
        handlePaste,
        openFilePicker,
        dragHandlers: rawDragHandlers,
    } = useFileAttachments({ mode: modelState.mode, onError });

    // Sync file attachments from hook to store
    // Note: We need to intercept processFiles to add to store instead
    const processFilesWithStore = useCallback(async (files: File[] | Array<{ file: File; meta?: any }>) => {
        await processFiles(files);
    }, [processFiles]);

    // Sync local PDF info to store
    useEffect(() => {
        setLocalPdfInfo(localPdfInfo ?? null);
    }, [localPdfInfo, setLocalPdfInfo]);

    // YouTube video detection
    const youtubeVideoInfo = useYouTubeVideoDetection();

    // Sync YouTube info to store
    useEffect(() => {
        if (youtubeVideoInfo.isYouTubeVideo) {
            setYouTubeVideoInfo({
                videoId: youtubeVideoInfo.videoId!,
                url: youtubeVideoInfo.url!,
                title: youtubeVideoInfo.title!,
            });
        } else {
            setYouTubeVideoInfo(null);
        }
    }, [youtubeVideoInfo.isYouTubeVideo, youtubeVideoInfo.videoId, youtubeVideoInfo.url, youtubeVideoInfo.title, setYouTubeVideoInfo]);

    // Selected text detection
    const { hasSelectedText, selectedTextInfo, clearSelection } = useSelectedTextDetection();

    // Sync selected text to store
    useEffect(() => {
        if (hasSelectedText && selectedTextInfo) {
            setSelectedTextInfo({
                text: selectedTextInfo.text,
                url: selectedTextInfo.pageUrl,
                title: selectedTextInfo.pageTitle,
            });
        } else {
            setSelectedTextInfo(null);
        }
    }, [hasSelectedText, selectedTextInfo, setSelectedTextInfo]);

    // Wrap drag handlers to sync isDragging to store
    const dragHandlers = {
        onDragEnter: (e: React.DragEvent) => {
            rawDragHandlers.onDragEnter(e);
            setIsDragging(true);
        },
        onDragLeave: (e: React.DragEvent) => {
            rawDragHandlers.onDragLeave(e);
            // Check if leaving the form
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            if (e.clientX <= rect.left || e.clientX >= rect.right || e.clientY <= rect.top || e.clientY >= rect.bottom) {
                setIsDragging(false);
            }
        },
        onDragOver: rawDragHandlers.onDragOver,
        onDrop: (e: React.DragEvent) => {
            rawDragHandlers.onDrop(e);
            setIsDragging(false);
        },
    };

    // Attachment handlers that use processFiles and update store
    const handleAttachLocalPdf = useCallback(async () => {
        if (!localPdfInfo) return;
        setIsAttachingLocalPdf(true);
        try {
            const response = await fetch(localPdfInfo.url);
            const blob = await response.blob();
            const file = new File([blob], localPdfInfo.filename, { type: 'application/pdf' });
            await processFilesWithStore([file]);
        } catch (error) {
            onError?.('Failed to attach PDF', 'error');
        } finally {
            setIsAttachingLocalPdf(false);
        }
    }, [localPdfInfo, processFilesWithStore, onError, setIsAttachingLocalPdf]);

    // YouTube video attachment hook - properly fetches transcript from backend
    const youtubeVideoInfoForHook = youtubeVideoInfo.isYouTubeVideo ? {
        videoId: youtubeVideoInfo.videoId!,
        url: youtubeVideoInfo.url!,
        title: youtubeVideoInfo.title!,
    } : null;

    const { handleAttachYouTubeVideo } = useYouTubeVideoAttachment({
        youtubeVideoInfo: youtubeVideoInfoForHook,
        mode: modelState.mode,
        onError,
        processFiles: processFilesWithStore,
    });

    const handleAttachSelectedText = useCallback(async () => {
        if (!selectedTextInfo) return;
        setIsAttachingSelectedText(true);
        try {
            const sourceAttribution = [
                '',
                '---',
                '📋 User Copied Text',
                `This text was copied by the user from a webpage.`,
                '',
                `📄 Source: ${selectedTextInfo.pageTitle}`,
                `🔗 URL: ${selectedTextInfo.pageUrl}`,
            ].join('\n');

            const textWithSource = selectedTextInfo.text + '\n' + sourceAttribution;
            const blob = new Blob([textWithSource], { type: 'text/plain' });
            const file = new File([blob], `selected-text-${Date.now()}.txt`, { type: 'text/plain' });
            await processFilesWithStore([file]);
            clearSelection();
            dismissSelectedText();
        } catch (error) {
            onError?.('Failed to add selected text', 'error');
        } finally {
            setIsAttachingSelectedText(false);
        }
    }, [selectedTextInfo, processFilesWithStore, clearSelection, dismissSelectedText, onError, setIsAttachingSelectedText]);

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

    const { isSearchMode, toggleSearchMode } = useSearchMode();

    // Auto-disable search mode when a workflow is activated
    useEffect(() => {
        if (activeWorkflow && isSearchMode) {
            toggleSearchMode();
        }
    }, [activeWorkflow]);

    // Handle send with attachments and workflow
    const handleSend = async () => {
        if (!(await validateBeforeSend(input, fileAttachments))) {
            return;
        }

        if (activeWorkflow) {
            onSendMessage(input, fileAttachments, tabAttachments, activeWorkflow.id);
            handleClearWorkflow();
        } else {
            onSendMessage(input, fileAttachments, tabAttachments);
        }

        setInput('');
        clearForNewMessage();
    };

    // Add paste event listener
    useEffect(() => {
        const composerElement = composerRef.current;
        if (!composerElement) return;
        composerElement.addEventListener('paste', handlePaste as any);
        return () => composerElement.removeEventListener('paste', handlePaste as any);
    }, [handlePaste]);

    // Hide voice FAB when there's text
    const setVoiceFabVisibility = useUINavigationStore.getState().setVoiceFabVisibility;
    useEffect(() => {
        setVoiceFabVisibility(!input.trim());
    }, [input]);

    return (
        <div className="px-4 pb-2 shrink-0 relative z-10">
            {/* Unified model selector (cloud + CLI providers) */}
            <ComposerHeader />

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                }}
                className="w-full relative z-[1]"
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

                <Composer
                    input={input}
                    setInput={setInput}
                    isLoading={isLoading}
                    isRecording={isRecording}
                    onRecordingChange={onRecordingChange}
                    voiceInputRef={voiceInputRef}
                    onStop={onStop}
                    pendingMessageId={pendingMessageId}
                    nextMessageId={nextMessageId}
                    modelState={modelState}
                    onModeChange={onModeChange}
                    onError={onError}
                    openFilePicker={openFilePicker}
                    processFiles={processFilesWithStore}
                    activeWorkflow={activeWorkflow}
                    showSlashDropdown={showSlashDropdown}
                    slashSearchQuery={slashSearchQuery}
                    handleSelectWorkflow={handleSelectWorkflow}
                    handleClearWorkflow={handleClearWorkflow}
                    handleSlashCommandDetection={handleSlashCommandDetection}
                    handleAttachLocalPdf={handleAttachLocalPdf}
                    handleAttachYouTubeVideo={handleAttachYouTubeVideo}
                    handleAttachSelectedText={handleAttachSelectedText}
                    showModeDropdown={showModeDropdown}
                    onToggleModeDropdown={setShowModeDropdown}
                    composerRef={composerRef}
                    textareaRef={textareaRef}
                />
            </form>
        </div>
    );
};
