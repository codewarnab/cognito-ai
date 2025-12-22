import { useRef, useCallback } from 'react';
import { validateFile, createImagePreview, isImageFile, isAudioFile, createAudioPreview, getAudioDuration } from '@/utils/files';
import type { FileAttachmentMeta } from '@/components/features/chat/components/attachments';
import type { AIMode } from '@/components/features/chat/types';
import { useAttachmentsStore } from '@/stores';

interface UseFileAttachmentsOptions {
    mode: AIMode;
    onError?: (message: string, type?: 'error' | 'warning' | 'info') => void;
}

/** Options for processing a single file with optional metadata */
export interface ProcessFileOptions {
    file: File;
    meta?: FileAttachmentMeta;
}

export const useFileAttachments = ({ mode, onError }: UseFileAttachmentsOptions) => {
    // Use Zustand store instead of local state
    const attachments = useAttachmentsStore((s) => s.fileAttachments);
    const isDragging = useAttachmentsStore((s) => s.isDragging);
    const addFileAttachment = useAttachmentsStore((s) => s.addFileAttachment);
    const removeFileAttachment = useAttachmentsStore((s) => s.removeFileAttachment);
    const clearFileAttachments = useAttachmentsStore((s) => s.clearFileAttachments);
    const setIsDragging = useAttachmentsStore((s) => s.setIsDragging);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Process files (shared between file input, paste, and drag & drop)
    // Accepts either File[] for backward compatibility or ProcessFileOptions[] for metadata support
    const processFiles = useCallback(async (files: File[] | ProcessFileOptions[]) => {
        for (const item of files) {
            // Normalize input: support both File and ProcessFileOptions
            const file = item instanceof File ? item : item.file;
            const meta = item instanceof File ? undefined : item.meta;

            const validation = validateFile(file);

            if (!validation.valid) {
                alert(validation.error);
                continue;
            }

            const id = `${Date.now()}-${Math.random()}`;

            // Determine file type
            let type: 'image' | 'document' | 'audio' = 'document';
            if (isImageFile(file)) {
                type = 'image';
            } else if (isAudioFile(file)) {
                type = 'audio';
            }

            // Create preview for images and audio
            let preview: string | undefined;
            let duration: number | undefined;

            if (type === 'image') {
                try {
                    preview = await createImagePreview(file);
                } catch (error) {
                    console.error('Failed to create image preview', error);
                }
            } else if (type === 'audio') {
                try {
                    preview = await createAudioPreview(file);
                    duration = await getAudioDuration(file);
                } catch (error) {
                    console.error('Failed to process audio file', error);
                    // Still add the file, just without duration
                    try {
                        preview = await createAudioPreview(file);
                    } catch {
                        // Ignore preview error
                    }
                }
            }

            addFileAttachment({ id, file, preview, type, duration, meta });
        }
    }, [addFileAttachment]);

    // Handle file selection from file input
    const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) {
            return;
        }
        const files = Array.from(e.target.files);
        await processFiles(files);
        // Reset input
        e.target.value = '';
    }, [processFiles]);

    // Handle paste event for file pasting
    const handlePaste = useCallback(async (e: ClipboardEvent) => {
        // Check if there are files in the clipboard
        if (!e.clipboardData || !e.clipboardData.files || e.clipboardData.files.length === 0) {
            return;
        }

        // Check if in local mode and show toast (before preventing default)
        if (mode === 'local') {
            e.preventDefault();
            onError?.('File attachments are not supported in Local mode. Please switch to Cloud mode to attach files.', 'warning');
            return;
        }

        // Prevent default paste behavior when pasting files in cloud mode
        e.preventDefault();

        const files = Array.from(e.clipboardData.files);
        await processFiles(files);
    }, [mode, onError, processFiles]);

    // Handle drag and drop
    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, [setIsDragging]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Check if we're leaving the form element
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;

        if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
            setIsDragging(false);
        }
    }, [setIsDragging]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        // Check if in local mode
        if (mode === 'local') {
            onError?.('File attachments are not supported in Local mode. Please switch to Cloud mode to attach files.', 'warning');
            return;
        }

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            await processFiles(files);
        }
    }, [mode, onError, processFiles, setIsDragging]);

    // Remove attachment
    const handleRemoveAttachment = useCallback((id: string) => {
        removeFileAttachment(id);
    }, [removeFileAttachment]);

    // Clear all attachments
    const clearAttachments = useCallback(() => {
        clearFileAttachments();
    }, [clearFileAttachments]);

    // Open file picker
    const openFilePicker = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    return {
        attachments,
        isDragging,
        fileInputRef,
        processFiles,
        handleFileChange,
        handlePaste,
        handleRemoveAttachment,
        clearAttachments,
        openFilePicker,
        dragHandlers: {
            onDragEnter: handleDragEnter,
            onDragLeave: handleDragLeave,
            onDragOver: handleDragOver,
            onDrop: handleDrop,
        },
    };
};
