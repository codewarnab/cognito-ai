import { useState, useRef, useCallback } from 'react';
import { validateFile, createImagePreview, isImageFile } from '@/utils/files';
import type { FileAttachmentData } from '@/components/features/chat/components/attachments';
import type { AIMode } from '@/components/features/chat/types';

interface UseFileAttachmentsOptions {
    mode: AIMode;
    onError?: (message: string, type?: 'error' | 'warning' | 'info') => void;
}

export const useFileAttachments = ({ mode, onError }: UseFileAttachmentsOptions) => {
    const [attachments, setAttachments] = useState<FileAttachmentData[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Process files (shared between file input, paste, and drag & drop)
    const processFiles = useCallback(async (files: File[]) => {
        for (const file of files) {
            const validation = validateFile(file);

            if (!validation.valid) {
                alert(validation.error);
                continue;
            }

            const id = `${Date.now()}-${Math.random()}`;
            const type = isImageFile(file) ? 'image' : 'document';

            // Create preview for images
            let preview: string | undefined;
            if (type === 'image') {
                try {
                    preview = await createImagePreview(file);
                } catch (error) {
                    console.error('Failed to create image preview', error);
                }
            }

            setAttachments(prev => [
                ...prev,
                { id, file, preview, type }
            ]);
        }
    }, []);

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
    }, []);

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
    }, []);

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
    }, [mode, onError, processFiles]);

    // Remove attachment
    const handleRemoveAttachment = useCallback((id: string) => {
        setAttachments(prev => prev.filter(att => att.id !== id));
    }, []);

    // Clear all attachments
    const clearAttachments = useCallback(() => {
        setAttachments([]);
    }, []);

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
