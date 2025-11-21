import React, { useRef, useState, useEffect } from 'react';
import { type VoiceInputHandle } from '../../../../audio/VoiceInput';
import { SuggestedActions } from './SuggestedActions';
import { Composer } from './Composer';
import type { FileAttachmentData } from './FileAttachment';
import type { TabAttachmentData } from './TabAttachment';
import type { AIMode, RemoteModelType, ModelState, Message } from '../types';
import type { AppUsage } from '../../../../ai/types/usage';
import type { LocalPdfInfo } from '../../../../hooks/useActiveTabDetection';
import { useFileAttachments } from '../../../../hooks/useFileAttachments';
import { useLocalPdfAttachment } from '../../../../hooks/useLocalPdfAttachment';
import { useYouTubeVideoDetection } from '../../../../hooks/useYouTubeVideoDetection';
import { useYouTubeVideoAttachment } from '../../../../hooks/useYouTubeVideoAttachment';
import { useWorkflowMode } from '../../../../hooks/useWorkflowMode';
import { useChatInputValidation } from '../../../../hooks/useChatInputValidation';

interface ChatInputProps {
    messages: Message[];
    input: string;
    setInput: (value: string) => void;
    onSendMessage: (
        messageText?: string, 
        attachments?: FileAttachmentData[], 
        tabAttachments?: TabAttachmentData[],
        workflowId?: string
    ) => void;
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
    // usage, // Token usage tracking
    // usage, // Token usage tracking
    localPdfInfo, // Local PDF detection info
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const composerRef = useRef<HTMLDivElement>(null);
    const internalVoiceInputRef = useRef<VoiceInputHandle>(null);
    const [showModeDropdown, setShowModeDropdown] = useState(false);
    const [tabAttachments, setTabAttachments] = useState<Array<{ id: string; title: string; url: string; favIconUrl?: string }>>([]);

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

    // YouTube video detection and attachment
    const youtubeVideoInfo = useYouTubeVideoDetection();
    const {
        isAttachingVideo,
        shouldShowYouTubeVideoSuggestion,
        handleAttachYouTubeVideo,
        handleDismissYouTubeVideo,
    } = useYouTubeVideoAttachment({
        youtubeVideoInfo: youtubeVideoInfo.isYouTubeVideo ? {
            url: youtubeVideoInfo.url!,
            videoId: youtubeVideoInfo.videoId!,
            title: youtubeVideoInfo.title!,
        } : null,
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
    const handleSend = async () => {
        // Validate input before sending
        if (!(await validateBeforeSend(input, attachments))) {
            return;
        }

        // If workflow is active, add workflow metadata to message
        if (activeWorkflow) {
            onSendMessage(input, attachments, tabAttachments, activeWorkflow.id);
            handleClearWorkflow();
        } else {
            onSendMessage(input, attachments, tabAttachments);
        }

        setInput('');
        clearAttachments();
        setTabAttachments([]);
    };

    const handleAddTabAttachments = (tabs: Array<{ id: string; title: string; url: string; favIconUrl?: string }>) => {
        setTabAttachments(prev => [...prev, ...tabs]);
    };

    const handleRemoveTabAttachment = (id: string) => {
        setTabAttachments(prev => prev.filter(tab => tab.id !== id));
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
                tabAttachments={tabAttachments}
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
                    attachments={attachments}
                    isDragging={isDragging}
                    openFilePicker={openFilePicker}
                    handleRemoveAttachment={handleRemoveAttachment}
                    processFiles={processFiles}
                    tabAttachments={tabAttachments}
                    handleRemoveTabAttachment={handleRemoveTabAttachment}
                    handleAddTabAttachments={handleAddTabAttachments}
                    activeWorkflow={activeWorkflow}
                    showSlashDropdown={showSlashDropdown}
                    slashSearchQuery={slashSearchQuery}
                    handleSelectWorkflow={handleSelectWorkflow}
                    handleClearWorkflow={handleClearWorkflow}
                    handleSlashCommandDetection={handleSlashCommandDetection}
                    localPdfInfo={localPdfInfo}
                    shouldShowLocalPdfSuggestion={shouldShowLocalPdfSuggestion ?? false}
                    isAttachingLocalPdf={isAttachingLocalPdf}
                    handleAttachLocalPdf={handleAttachLocalPdf}
                    handleDismissLocalPdf={handleDismissLocalPdf}
                    youtubeVideoInfo={youtubeVideoInfo.isYouTubeVideo ? {
                        url: youtubeVideoInfo.url!,
                        videoId: youtubeVideoInfo.videoId!,
                        title: youtubeVideoInfo.title!,
                    } : null}
                    shouldShowYouTubeVideoSuggestion={shouldShowYouTubeVideoSuggestion ?? false}
                    isAttachingVideo={isAttachingVideo}
                    handleAttachYouTubeVideo={handleAttachYouTubeVideo}
                    handleDismissYouTubeVideo={handleDismissYouTubeVideo}
                    showModeDropdown={showModeDropdown}
                    onToggleModeDropdown={setShowModeDropdown}
                    composerRef={composerRef}
                    textareaRef={textareaRef}
                />
            </form>
        </div>
    );
};
